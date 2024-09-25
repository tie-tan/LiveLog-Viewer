const fs = require('fs'); 
const http = require('http');

let lastFileSize = 0; 
let queue = [];
const port  = 9000;
let clients = []; // list of all clients phele ak hi client rkhnaa
let lastIncompleteLine = ''; // ye wala end m krna h jab eroor aaye vo space wala

// noramla code likhne k baad bana server
const server = http.createServer((req, res) => {

    // Serve the HTML file for the client
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync('index.html'));
    }

});

// Initial read of the file to capture existing content before watching for changes.
fs.readFile('data.txt', 'utf8', (err, data) => { // 'fs.readFile' reads the entire content of the file asynchronously.
    if (err) { // Check for errors during the initial file read.
      console.error('Error reading the file:', err); // Log the error to the console.
      return; // Exit the function if there's an error.
    }

    //  console.log(data)
    
    // const lines = data.split('\n'); // ye phele likhan h fir exrea r aayega usko htna h 
    const lines = data.split(/\r?\n/); // Split the file content into lines using the newline character ('\n') as the delimiter.
    
    lines.forEach(line => { // Loop through each line in the file content.
      queue.push(line); // Add each line to the `queue`.
      if (queue.length > 10) queue.shift(); // Keep only the last 10 lines by removing the oldest ones.
    });
  
    console.log(queue); // Output the initial last 10 lines of the file to the console.
    
    lastIncompleteLine = queue[queue.length - 1];
    // ye waali line baad m likhnaa
    lastFileSize = Buffer.byteLength(data, 'utf8'); // Calculate and store the byte length of the file content, so future reads can start from here.
  });

const readNewContent = () => { // A function to read the new content from the file since the last read.
  fs.stat('data.txt', (err, stats) => { // 'fs.stat' retrieves file metadata (like size, modification time, etc.).
    if (err) { // Check for errors while retrieving file metadata.
      console.error('Error getting file stats:', err); // Log the error to the console.
      return; // Exit the function in case of an error.
    }

    const newSize = stats.size; // Get the current size of the file.
    if (newSize > lastFileSize) { // If the file size has increased, new content has been added.
      
        const buffer = Buffer.alloc(newSize - lastFileSize); // Allocate a buffer to hold the new content. The buffer size is the difference between the new file size and the last read size.
      const fd = fs.openSync('data.txt', 'r'); // Open the file synchronously in read mode ('r'). This returns a file descriptor (`fd`).

      // Use 'fs.read' to read new content from the file.
      fs.read(fd, buffer, 0, newSize - lastFileSize, lastFileSize, (err, bytesRead) => { 
        // Parameters for `fs.read`:
        // - `fd`: file descriptor returned by `fs.openSync`.
        // - `buffer`: the buffer that will hold the data read from the file.
        // - `0`: the offset in the buffer to start writing at (starting from the beginning of the buffer).
        // - `newSize - lastFileSize`: the number of bytes to read (i.e., the newly added content).
        // - `lastFileSize`: the position in the file where the reading should start (i.e., where the last read ended).

        if (err) { // Check for errors during reading.
          console.error('Error reading file:', err); // Log the error if one occurred.
          return; // Exit the function in case of an error.
        }

        // phele const rkhan h isko
        let newContent = buffer.toString('utf8'); // Convert the buffer content to a string (since the file is assumed to contain text in UTF-8 encoding).
        
        // ye line bhi jab space wlaa error aaye
        newContent = lastIncompleteLine + newContent;

        console.log(newContent);

        // jab space wla eroor aaye
        if(queue.length > 0){
            queue.pop();
        }

        // r waaala error aaye tab
        // const lines = data.split(/\r?\n/); 
        const lines = newContent.split('\n'); // Split the new content into lines using the newline character ('\n') as the delimiter.

        lines.forEach(line => { // Loop through each line in the newly read content.
          queue.push(line); // Add the current line to the `queue` array.
          if (queue.length > 10) queue.shift(); // If there are more than 10 lines in the `queue`, remove the oldest line to keep only the last 10.
        });

        console.log(queue); // Output the final `queue` array (containing the last 10 lines of new content) to the console.
        
        // ye wala part websocket banaye tab aayega
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                queue.forEach(line => client.send(line));
                // client.send(queue);   
            }
        });

        lastIncompleteLine = queue[queue.length-1];

        lastFileSize = newSize; // Update `lastFileSize` to the new file size, so the next read will start from here.
      });
    }
  });
};

// Watch the file for changes (i.e., when new data is added).
fs.watchFile( // 'fs.watchFile' monitors the file for changes.
  'data.txt', // The file to watch.
  {
    persistent: true, // Keep watching even if the script finishes execution elsewhere (keep the event loop alive).
    interval: 4000, // Polling interval in milliseconds (checks for file changes every 4 seconds).
  },
  (curr, prev) => { // This callback is invoked whenever the file is modified.
    console.log('\nThe file was edited'); // Log that the file has been modified.
    // console.log('Previous Modified Time', prev.mtime); // Log the previous modification time of the file.
    // console.log('Current Modified Time', curr.mtime); // Log the current modification time.

    // Read the new content that has been added to the file since the last size.
    readNewContent(); // Call the function to read new content from the file.
  }
);

const WebSocket = require('ws');

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {

    console.log("connected");
    clients.push(ws);

    queue.forEach(line => ws.send(line));
    console.log(queue);

    // update hone per update new lines waale function m change hoga kro

  ws.on('message', function incoming(message) {
    // Handle incoming message
    // incoming message client se kuch h nahi to no need
  });

  ws.on('close', function() {
    // Handle connection close
    console.log("Closed");
  });

});



server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });


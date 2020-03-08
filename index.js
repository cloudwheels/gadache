require('dotenv').config();
const shell = require('shelljs');
const dbg = require('debug')('index:dbg');
const os = require('os');
const getUsr = require('username'); //use os.userInfo().username instead?
const wget = require('node-wget'); //? use http request?
const fetch = require('node-fetch');
const path = require('path');
const decompress = require('decompress');
const decompressTargz = require('decompress-targz');
const util = require('util');
const fs = require('fs');
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const stream = require('stream');
const streamPipeline = util.promisify(stream.pipeline);
const axios = require('axios');



(async () => {

//TODO use fs for file system operations


dbg("Checking system config...");
const osPlatform = os.platform();
const osArch = os.arch();

dbg("Platform: " + osPlatform);
dbg("Architecture: " + osArch);

const usr = await getUsr();
dbg("current user:", usr);

const usrHome = os.userInfo().homedir;
dbg("user home:", usrHome);

//TODO: re-factor which(program) into function

/*
dbg('checking for rubbish...');
if (!shell.which('xyxyz')) {
  shell.echo('Sorry, this script requires some program');
  shell.exit(1);
  return;
}
*/
dbg("Checking pre-requisites...");

dbg("checking for git...");
const gitLocation = shell.which('git');
if (!gitLocation) {
  shell.echo("Sorry, this script requires git");
  shell.exit(1);
  return;
}
dbg("Found git at: " + gitLocation);


//TODO switch for different OS
const dashcoreDownloadURL =
  process.env.DASHCORE_DOWNLOAD_BASE_URL +
  process.env.DASHCORE_VERSION +
  '/dashcore-0.' + process.env.DASHCORE_VERSION +
  process.env.DASHCORE_DOWNLOAD_OS_URL_LINUX_X86_64;
  
dbg("Dashcore Download URL: " + dashcoreDownloadURL);

const tmp = shell.tempdir();
dbg("Temp directory: " + tmp);
 

const installDir = path.join(usrHome,".gadache");
dbg("Install Directory: " + installDir);

//TODO - check for exisiting dashcore
const dashcoreDir = path.join(installDir, '.dashcore')
dbg("dashcoreDir: " + dashcoreDir);

const dashcoreConfFile = path.join(dashcoreDir, process.env.DASHCORE_CONF_FILENAME);
//TODO: ||? process.env.DASHCORE_CONF_PATH
dbg("Dashcore Config File: " + dashcoreConfFile);

const dashcoreDaemon = path.join(dashcoreDir, 'dashd');
dbg("Dashcore Daemon: " + dashcoreDaemon);

const dashcoreNodeDir = path.join(installDir, 'dashcore-node');
dbg("Dashcore Daemon: " + dashcoreDaemon);

const dashcoreNodeConfFile = path.join(dashcoreNodeDir, 'dashcore-node.json');
dbg("Dashcore Noge Config File: " + dashcoreNodeConfFile);


//TODO fix / in file / directory name (?path.join);
//correct file endings,
//process error/success


dbg("Creating main install directory...");
shell.mkdir(installDir);

/*
const w = util.promisify(wget);
await(
  w({url: dashcoreDownloadURL, dest: path.join(tmp,'core.tar.gz')},
    function (error, response, body) {
        if (error) {
            console.log('--- error:');
            console.log(error);            // error encountered
        } else {
            console.log('--- headers:');
            console.log(response.headers); // response headers
            //console.log('--- body:');
            //console.log(body);             // content of package
        }
    }
)
);
*/
dbg("Downloading core...");

/*
const response = await fetch(dashcoreDownloadURL);
if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);
await streamPipeline(response.body, fs.createWriteStream(path.join(tmp,'core.tar.gz')));
*/
await download(dashcoreDownloadURL,path.join(tmp,'core.tar.gz'));


dbg("Core downloaded.");

//TODO - verify installation



dbg("Creating Dashcore Directory....");
shell.mkdir('-p', dashcoreDir);

//TODO change decompress depending on file extension (os/platform)


dbg("Decompressing Files...");
await
  decompress(path.join(tmp,'core.tar.gz'), dashcoreDir, {
    plugins: [
        decompressTargz()
    ]
})//.then(() => {
  //  console.log('Files decompressed');
//})
;

dbg("Files decompressed...");

//**** TODO: RENAME OR SET VAR FOR EXTRACTED DIRETORY USING VERSION ****

dbg("copy dashcore binaries");
shell.cp('-f', path.join(dashcoreDir,'dashcore-0.15.0','bin','dashd'), dashcoreDir)
shell.cp('-f', path.join(dashcoreDir,'dashcore-0.15.0','bin','dash-cli'), dashcoreDir)




dbg("Writing dashcore config file");
//TODO - or appendFile or check for existance

//?? async


await (
  writeFile(dashcoreConfFile,
  "# general" + "\n" +
  "port=" + process.env.DASHCORE_P2P_PORT + "\n" +
  "devnet="  + process.env.DEVNET + "\n" +
  "allowprivatenet=1" + "\n" +
  "daemon=1" + "\n" +
  "logtimestamps=1" + "\n" +
  "maxconnections=256" + "\n" +
  "debug=0" + "\n" +
  "printtoconsole=1 # print to stdout/stderr for Docker" + "\n" +
  "# optional indices (required for Insight)" + "\n" +
  "txindex=1" + "\n" +
  "addressindex=1" + "\n" +
  "timestampindex=1" + "\n" +
  "spentindex=1" + "\n" +
  "# ZeroMQ notifications (required for Insight)" + "\n" +
  "zmqpubrawtx=tcp://0.0.0.0:" + process.env.DASHCORE_ZEROMQ_PORT + "\n" +
  "zmqpubrawtxlock=tcp://0.0.0.0:" + process.env.DASHCORE_ZEROMQ_PORT + "\n" +
  "zmqpubhashblock=tcp://0.0.0.0:" + process.env.DASHCORE_ZEROMQ_PORT + "\n" +
  "#zmqpubhashtx=tcp://0.0.0.0:" + process.env.DASHCORE_ZEROMQ_PORT + "\n" +
  "#zmqpubhashtxlock=tcp://0.0.0.0:" + process.env.DASHCORE_ZEROMQ_PORT + "\n" +
  "#zmqpubrawblock=tcp://0.0.0.0:" + process.env.DASHCORE_ZEROMQ_PORT + "\n" +
  "# JSONRPC" + "\n" +
  "server=1" + "\n" +
  "rpcuser=" + process.env.DASHCORE_RPC_USER + "\n" +
  "rpcpassword=" + process.env.DASHCORE_RPC_PASSWORD + "\n" +
  "rpcport=" + process.env.DASHCORE_RPC_PORT + "\n" +
  "rpcbind=0.0.0.0" + "\n" +
  "rpcallowip=0.0.0.0/0" + "\n" +
  "rpcworkqueue=64" + "\n" +
  "# external network" + "\n" +
  "listen=1" + "\n" +
  "bind=0.0.0.0" + "\n"
  )
);

dbg('Wrote config file:\n' + await (readFile(dashcoreConfFile)));


dbg("Starting Dashcore");

shell.exec(dashcoreDaemon, function(code, stdout, stderr) {
  console.log('Exit code:', code);
  console.log('Program output:', stdout);
  console.log('Program stderr:', stderr);
});



dbg("setting up Insight API");
dbg("cloning dashcore-node");

shell.exec("git clone https://github.com/dashevo/dashcore-node.git " + dashcoreNodeDir);
shell.cd(dashcoreNodeDir);
dbg("install dashcore-node dependencies");
shell.exec("npm i");



const insightConfigJSON =
{
  "network": "testnet",
  "port": 3001,
  "services": [
    "dashd",
    "web",
    "@dashevo/insight-api"
  ],
  "servicesConfig": {
    "dashd": {
      "connect": [
        {
          "rpchost": "127.0.0.1",
          "rpcport": 30002,
          "rpcuser": "dashrpc",
          "rpcpassword": "password",
          "zmqpubrawtx": "tcp://dashcore:30003",
          "zmqpubhashblock": "tcp://dashcore:30003"
        }
      ]
    },
    "@dashevo/insight-api": {
      "disableRateLimiter": true
    }
  }
};

dbg("Creating Insight Config JSON...");


insightConfigJSON.port=process.env.INSIGHT_API_PORT;
insightConfigJSON.servicesConfig.dashd.connect[0].rpcport=process.env.DASHCORE_RPC_PORT;
insightConfigJSON.servicesConfig.dashd.connect[0].rpcuser=process.env.DASHCORE_RPC_USER;
insightConfigJSON.servicesConfig.dashd.connect[0].rpcpassword=process.env.DASHCORE_RPC_PASSWORD;
const ZMQSocket = "tcp://127.0.0.1:" + process.env.DASHCORE_ZEROMQ_PORT;
insightConfigJSON.servicesConfig.dashd.connect[0].zmqpubrawtx=ZMQSocket;
insightConfigJSON.servicesConfig.dashd.connect[0].zmqpubhashblock=ZMQSocket;


dbg("Writing Insight Config ...");
//TODO - or appendFile or check for existance

//?? async


await (
  writeFile(dashcoreNodeConfFile,JSON.stringify(insightConfigJSON))
  );
  
dbg('Wrote config file:\n' + await (readFile(dashcoreNodeConfFile)));



dbg("Installing Insight-API service...");

//shell.cd(dashcoreNodeDir); // remove - should be there

shell.exec("./bin/dashcore-node install https://github.com/dashevo/insight-api/");

dbg("Running Insight-API service...");

shell.exec("./bin/dashcore-node start");
  
  
})(); //end main function



async function download (url, filepath) {

  const writer = fs.createWriteStream(filepath)

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  })

  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}
  


require('dotenv').config();
const dbg = require('debug')('index:dbg');
const shell = require('shelljs');
const os = require('os');
const path = require('path');
const decompress = require('decompress');
const decompressTargz = require('decompress-targz');
const util = require('util');
const fs = require('fs');
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const axios = require('axios');
const { MongoMemoryServer } = require('mongodb-memory-server');


///////////////////////////////////
// CHECK SYSTEM & SET CONFIG VARIABLES
//

dbg("SETTING GLOBAL CONFIG...");
const osPlatform = os.platform();
const osArch = os.arch();

dbg("Platform: " + osPlatform);
dbg("Architecture: " + osArch);

const usr = os.userInfo().username;
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


//TODO - move tmp dir under install dir
const tmp = shell.tempdir();
dbg("Temp directory: " + tmp);

const installDir = path.join(usrHome,".gadache");
dbg("Install Directory: " + installDir);

//TODO - check for exisiting dashcore
const dashcoreDir = path.join(usrHome, '.dashcore');  //(installDir, '.dashcore');
dbg("dashcoreDir: " + dashcoreDir);

const dashcoreConfFile = path.join(dashcoreDir, process.env.DASHCORE_CONF_FILENAME);
//TODO: ||? process.env.DASHCORE_CONF_PATH
dbg("Dashcore Config File: " + dashcoreConfFile);

const dashcoreDaemon = path.join(dashcoreDir, 'dashd');
dbg("Dashcore Daemon: " + dashcoreDaemon);

const dashcoreNodeDir = path.join(installDir, 'dashcore-node');
dbg("Dashcore-Node Directory: " + dashcoreNodeDir);

const dashcoreNodeConfFile = path.join(dashcoreNodeDir, 'dashcore-node.json'); //(dashcoreNodeDir, 'dashcore-node.json');
dbg("Dashcore-Node Config File: " + dashcoreNodeConfFile);

const insightApiUri = "http://" + process.env.INSIGHT_API_HOST+":"+process.env.INSIGHT_API_PORT+"/"+process.env.INSIGHT_API_PATH
dbg("insight API URI: " + insightApiUri);


const DAPIDir = path.join(installDir, 'dapi');
dbg("DAPI Directory: " + DAPIDir);

const DAPIConfFile = path.join(DAPIDir, '.env');
dbg("DAPI Config File: " + DAPIConfFile);

const driveDir = path.join(installDir, 'drive');
dbg("Drive Directory: " + driveDir);

const driveConfFile = path.join(driveDir, '.env');
dbg("Drive Config File: " + driveConfFile);

const mongoDBPath = path.join(installDir, 'mongo-data');
dbg("Mongo DB Data Directory: " + mongoDBPath);

//TODO fix / in file / directory name (?path.join);
//correct file endings,
//process error/success

//TODO CHECK IF EXISTS & IS EMPTY
dbg("Creating main install directory...");
shell.mkdir(installDir);

//TODO: Split services & data directories for easy cleanup / restore

dbg("Creating mongo db data directory...");
shell.mkdir(mongoDBPath);


//processes
var mongod;
var dashcoreProcess;
var InsightAPIProcess;
var DAPIApiProcess;
var DAPITxFilterProcess;
var driveSyncProcess;
var driveApiProcess;



//
// end set global config
//////////////////////////////////////

(async () => {
  
  startAll();

})(); //end main function



async function startAll(){
  startMongoDB();
  startCore();
  startInsight();
  startDAPI();
  startTxFilter();
  startDriveSync();
  startDriveApi();

}

async function installAll() {
  
  dbg("INSTALLING SERVICES...");
  startMongoDB();
  await installCore();
  startCore();
  await installInsight();
  startInsight();
  await installDAPI();
  startDAPI();
  startTxFilter();
  await installDrive();
  startDriveSync();
  startDriveApi();
  

}







async function installCore() {
////////////////////////////////////////////////////
// SETUP CORE
//

dbg("Downloading core...");

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
});

dbg("Files decompressed...");

//**** TODO: RENAME OR SET VAR FOR EXTRACTED DIRETORY USING VERSION ****

dbg("copy dashcore binaries");
shell.cp('-f', path.join(dashcoreDir,'dashcore-0.15.0','bin','dashd'), dashcoreDir)
shell.cp('-f', path.join(dashcoreDir,'dashcore-0.15.0','bin','dash-cli'), dashcoreDir)


dbg("Writing dashcore config file");
//TODO - or ?appendFile or check for existance

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
  "# ZMQ notifications (required for Insight)" + "\n" +
  "zmqpubrawtx=tcp://0.0.0.0:" + process.env.DASHCORE_ZMQ_PORT + "\n" +
  "zmqpubrawtxlock=tcp://0.0.0.0:" + process.env.DASHCORE_ZMQ_PORT + "\n" +
  "zmqpubhashblock=tcp://0.0.0.0:" + process.env.DASHCORE_ZMQ_PORT + "\n" +
  "#zmqpubhashtx=tcp://0.0.0.0:" + process.env.DASHCORE_ZMQ_PORT + "\n" +
  "#zmqpubhashtxlock=tcp://0.0.0.0:" + process.env.DASHCORE_ZMQ_PORT + "\n" +
  "#zmqpubrawblock=tcp://0.0.0.0:" + process.env.DASHCORE_ZMQ_PORT + "\n" +
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





//******
//TODO: CREATE GENESIS BLOCK & GENERATE (e.g. 3 blocks OTHER WISE DASHCORE GIVES ERROR)
//*****



//
// end install core
////////////////////////////////////////////////////
}


async function installInsight() {
////////////////////////////////////////////////////
// SETUP INSIGHT
//



dbg("setting up Insight API...");
dbg("cloning dashcore-node from " + process.env.DASHCORE_NODE_GIT_URL);

shell.exec("git clone " + process.env.DASHCORE_NODE_GIT_URL + " " + dashcoreNodeDir);
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
          "rpchost": "0.0.0.0",
          "rpcport": 20002,
          "rpcuser": "dashrpc",
          "rpcpassword": "password",
          "zmqpubrawtx": "tcp://0.0.0.0:29998",
          "zmqpubhashblock": "tcp://0.0.0.0:29998"
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
insightConfigJSON.servicesConfig.dashd.connect[0].rpchost=process.env.DASHCORE_HOST;
insightConfigJSON.servicesConfig.dashd.connect[0].rpcport=process.env.DASHCORE_RPC_PORT;
insightConfigJSON.servicesConfig.dashd.connect[0].rpcuser=process.env.DASHCORE_RPC_USER;
insightConfigJSON.servicesConfig.dashd.connect[0].rpcpassword=process.env.DASHCORE_RPC_PASSWORD;
const ZMQSocket = "tcp://" + process.env.DASHCORE_HOST + ":" + process.env.DASHCORE_ZMQ_PORT;
insightConfigJSON.servicesConfig.dashd.connect[0].zmqpubrawtx=ZMQSocket;
insightConfigJSON.servicesConfig.dashd.connect[0].zmqpubhashblock=ZMQSocket;


dbg("Writing Insight Config ...");
//TODO - or appendFile or check for existance

//?? async
await (
  writeFile(dashcoreNodeConfFile,JSON.stringify(insightConfigJSON))
  );
  
dbg('Wrote config file:\n' + await (readFile(dashcoreNodeConfFile)));



dbg("Installing Insight-API service from " + process.env.INSIGHT_API_GIT_URL +"...");

shell.exec(path.normalize('./bin/dashcore-node') + ' install ' + process.env.INSIGHT_API_GIT_URL);

//
//end installInsight()
////////////////////////////////////////////////////
}
  
  

async function installDAPI() {
////////////////////////////////////////////////////
// SETUP DAPI
//



dbg("setting up DAPI");
dbg("cloning DAPI repo from " + process.env.DAPI_GIT_URL);

shell.exec("git clone " + process.env.DAPI_GIT_URL + " " + DAPIDir);
shell.cd(DAPIDir);

dbg("install dapi dependencies");
shell.exec("npm i");

dbg("Writing dapi config file");
//TODO - or ?appendFile or check for existance

await (
  writeFile(DAPIConfFile,
  "INSIGHT_URI=" + insightApiUri + "\n" +
  "LIVENET=false" + "\n" +
  "DAPI_JSON_RPC_PORT="+process.env.DAPI_JSON_RPC_PORT + "\n" +
  "DAPI_GRPC_PORT="+process.env.DAPI_GRPC_PORT + "\n" +
  "TX_FILTER_STREAM_GRPC_PORT="+process.env.TX_FILTER_STREAM_GRPC_PORT + "\n" +
  "DASHCORE_RPC_PROTOCOL="+process.env.DASHCORE_RPC_PROTOCOL + "\n" +
  "DASHCORE_RPC_USER="+process.env.DASHCORE_RPC_USER + "\n" +
  "DASHCORE_RPC_PASS="+process.env.DASHCORE_RPC_PASSWORD + "\n" +
  "DASHCORE_RPC_HOST="+process.env.DASHCORE_HOST + "\n" +
  "DASHCORE_RPC_PORT="+process.env.DASHCORE_RPC_PORT + "\n" +
  "DASHCORE_ZMQ_HOST="+process.env.DASHCORE_HOST + "\n" +
  "DASHCORE_ZMQ_PORT="+process.env.DASHCORE_ZMQ_PORT + "\n" +
  "DASHCORE_P2P_HOST="+process.env.DASHCORE_HOST + "\n" +
  "DASHCORE_P2P_PORT="+process.env.DASHCORE_P2P_PORT + "\n" +
  "DASHCORE_P2P_NETWORK=testnet" + "\n" +
  "DRIVE_RPC_HOST="+process.env.DRIVE_RPC_HOST + "\n" +
  "DRIVE_RPC_PORT="+process.env.DRIVE_RPC_PORT + "\n" +
  "NETWORK=testnet" + "\n" +
  "BLOOM_FILTER_PERSISTENCE_TIMEOUT="+process.env.BLOOM_FILTER_PERSISTENCE_TIMEOUT + "\n" +
  "TENDERMINT_CORE_HOST="+process.env.TENDERMINT_CORE_HOST + "\n" +
  "TENDERMINT_CORE_PORT="+process.env.TENDERMINT_CORE_PORT + "\n"
  )
);

dbg('Wrote DAPI Config file:\n' + await (readFile(DAPIConfFile)));

}

//
//end installDAPI()
////////////////////////////////////////////////////


async function installDrive() {
////////////////////////////////////////////////////
// SETUP DAPI
//



dbg("setting up Drive");
dbg("cloning Drive repo from " + process.env.DRIVE_GIT_URL);

shell.exec("git clone " + process.env.DRIVE_GIT_URL + " " + driveDir);
shell.cd(driveDir);

dbg("Install Drive dependencies");
shell.exec("npm i");

dbg("Writing Drive config file");
//TODO - or ?appendFile or check for existance

await (
  writeFile(driveConfFile,
  "API_RPC_HOST="+process.env.DRIVE_RPC_HOST + "\n" +
  "API_RPC_PORT="+process.env.DRIVE_RPC_PORT + "\n" +
  "UPDATE_STATE_GRPC_HOST="+process.env.DRIVE_UPDATE_STATE_GRPC_HOST + "\n" +
  "UPDATE_STATE_GRPC_PORT="+process.env.DRIVE_UPDATE_STATE_GRPC_PORT + "\n" +
  "STATEVIEW_MONGODB_DB_PREFIX="+process.env.DRIVE_STATEVIEW_MONGODB_DB_PREFIX + "\n" +
  "STATEVIEW_MONGODB_URL="+process.env.DRIVE_STATEVIEW_MONGODB_URL + "\n" +
  "STATEVIEW_MONGODB_DB="+process.env.DRIVE_STATEVIEW_MONGODB_DB + "\n" +
  "DASHCORE_JSON_RPC_USER="+process.env.DASHCORE_RPC_USER + "\n" +
  "DASHCORE_JSON_RPC_PASS="+process.env.DASHCORE_RPC_PASSWORD + "\n" +
  "DASHCORE_JSON_RPC_HOST="+process.env.DASHCORE_HOST + "\n" +
  "DASHCORE_JSON_RPC_PORT="+process.env.DASHCORE_RPC_PORT + "\n" +
  "TENDERMINT_CORE_HOST="+process.env.TENDERMINT_CORE_HOST + "\n" +
  "TENDERMINT_CORE_PORT="+process.env.TENDERMINT_CORE_PORT + "\n"
  )
);

dbg('Wrote Drive Config file:\n' + await (readFile(driveConfFile)));

}


//
//end installDrive()
////////////////////////////////////////////////////
  


  
  

///////////
// HELPER FUNCTIONS
//////////






async function shellExecAsync(child, cmd, service){
  child = shell.exec(cmd, {async:true, silent:true});
child.stdout.on('data', function(data) {
  /* ... do something with data ... */
  console.log(service + ": " + data);
});
}

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



async function startCore(){
  dbg("Starting Dashcore");
  shellExecAsync(dashcoreProcess, dashcoreDaemon +' -conf='+dashcoreConfFile, "DASHCORE");
}

async function startInsight(){
  dbg("Get dashcore gensis block hash");
  // forces creation of network dir & first block - prevent insight start error
  //TODO - replace with faucet / masternode setup
  shell.exec(path.join(dashcoreDir,'dash-cli') + ' getblockhash 0');


  dbg("Running Insight-API service...");
  shell.cd(dashcoreNodeDir);
  shellExecAsync(InsightAPIProcess, path.normalize('./bin/dashcore-node') + ' start', "INSIGHT");

}

async function startDAPI(){
  
  dbg("Starting DAPI API service...");
  shell.cd(DAPIDir);
  shellExecAsync(DAPIApiProcess, "npm run api", "DAPI");

}


async function startTxFilter(){
  
  dbg("Starting Transaction Filter Stream  service...");
  shell.cd(DAPIDir);
  shellExecAsync(DAPITxFilterProcess, "npm run tx-filter-stream", "TX-FILTER");

}


async function startDriveSync(){
  
  dbg("Start Drive sync service...");
  shell.cd(driveDir);
  shellExecAsync(driveSyncProcess, "npm run sync", "DRIVE-SYNC");

}

async function startDriveApi(){
  
  dbg("Starting Drive API service...");
  shell.cd(driveDir);
  shellExecAsync(driveApiProcess, "npm run api", "DRIVE-API");

}


async function startMongoDB(){
  dbg("Creating in-memory mongodb...");

  //TODO: Add temp dir to config for clearup
  dbg("SET UP MONGO DB...");
  
  mongod = new MongoMemoryServer({
    instance: {
      port: 27017, // by default choose any free port
      ip: process.env.DRIVE_STATEVIEW_MONGODB_HOST, // by default '127.0.0.1', for binding to all IP addresses set it to `::,0.0.0.0`,
      dbName: process.env.DRIVE_STATEVIEW_MONGODB_DBNAME, // by default generate random dbName
      dbPath: mongoDBPath
    },
    binary: {
      //** TODO HANDLE VERSION NOT FOUND
      version: "4.2.3" //https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian10-4.2.3.tgz
    }
  });
  const uri = await mongod.getUri();
  dbg("uri: " + uri);
  const port = await mongod.getPort();
  dbg("port: " + port);
  const dbPath = await mongod.getDbPath();
  dbg("dbPath: " + dbPath);
  const dbName = await mongod.getDbName();
  dbg("dbName: " + dbName);
}
  


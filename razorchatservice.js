// razorchatservice.js

// Synchronet Service for remote sysop chat

// Example configuration (in ctrl/services.ini):

// [RazorChat]
// Port=10006
// MaxClients=5
// Command=razorchatservice.js

load("sbbsdefs.js");
load("text.js");

const PCHAT_LEN = 1000;
const clr_chatlocal = 13;
const clr_chatremote = 14;
var debug = false;
var local = false;
var node = 1;
var error_log_level = LOG_WARNING;
var quit=false;
var authenticated=false;
var chatstarted=0; // this will be checked to make sure it matches the node when a message is sent

while(client.socket.is_connected && !quit)
{
	// Get Request
	cmdline = client.socket.recvline(1024 /*maxlen*/, 300 /*timeout*/);
	
	if(cmdline==null)
	{
		if(client.socket.is_connected)
			log(LOG_WARNING, "!TIMEOUT waiting for request");
		else
			log(LOG_WARNING, "!client disconnected");
		break;
	}

	if(cmdline=="") 	/* ignore blank commands */
		continue;
		
	cmd=cmdline.split(' ');

	// all commands will start with either AUTHINFO, CHAT, or QUIT depending on which they apply to
	if(!authenticated)
	{
		switch(cmd[0].toUpperCase())
		{
			case "AUTHINFO":
				// The authentication command received from the client will be "AUTHINFO username password syspass"
				var loginresult=login(cmd[1], cmd[2]);
				if(loginresult && system.check_syspass(cmd[3]))
				{
					if(user.security.level>=90)
					{
						// client user is sysop
						authenticated=true;
						writeln("281 Authentication successful");
						log("Authentication successful");
					}
					else
					{
						writeln("502 Sysops only");
						log("User not sysop");
					}
				}
				break;
				
			default:
				// the service requires authentication
				writeln("502 Authentication failure");
				log("Client didn't authenticate first");
				break;
		}
	}
	else
	{
		// client is authenticated, other commands can proceed
		switch(cmd[0].toUpperCase())
		{
			// CHAT will receive START, MESSAGE, or STATUS & it will send MESSAGE
			// STATUS may not be necessary here, as it currently goes to the pager module
			// START may not be necessary here, as long as chat is separate from the pager & each chat is a separate connection
			case "CHAT":
				if(cmd[1]==undefined)
				{
					writeln("CHAT: 500 Syntax error or unknown command");
					break;
				}
				switch(cmd[1].toUpperCase())
				{
					case "START":
						tempstring=cmdline.slice("CHAT START ".length);
						startchat(tempstring);
						break;

					case "MESSAGE":
						tempstring=cmdline.slice("CHAT MESSAGE ".length);
						recvmsg(tempstring);
						break;
				}
				break;

			// QUIT doesn't require any other parameters
			case "QUIT":
				logout();
				writeln("205 closing connection - goodbye!");
				//quit=true;
				break;
				
			default:
				writeln("DEFAULT: 500 Syntax error or unknown command");
				break;
		}
	}
}

function startchat(nodestring)
{
	// chat start format: CHAT START NODE:$node#
	var nodenumber=nodestring.split(':')[1];
	chatstarted=nodenumber;
	log("Start chat for node: " + nodenumber);
	writeln("200 OK. CHAT STARTed");
}

function recvmsg(nodeandmessage)
{
	// message format: CHAT MESSAGE NODE:$node#.$message
	var chatmessage=nodeandmessage.split('.')[1];
	var nodenumber=nodeandmessage.split('.')[0].split(':')[1];
	if(chatstarted>0)
	{
		// chat is started
		if(chatstarted==nodenumber)
		{
			// this is the node# that chat was started for
			log("Chat for node " + nodenumber + ": " + chatmessage);
			writeln("200 OK. recvd: CHAT MESSAGE");
		}
		else
		{
			log("Chat start indicated a different node.  Chat was started for node " + chatstarted + ", but the message says it's for node " + nodenumber);
			writeln("500 Syntax error: Chat start indicated a different node.  Chat was started for node " + chatstarted + ", but the message says it's for node " + nodenumber);
		}
	}
	else
	{
		// a message was sent, but chat isn't started
		log("Chat message sent before chat was started");
		writeln("500 Syntax error: Chat message sent before chat was started");
	}
}

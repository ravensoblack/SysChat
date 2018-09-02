// razorpageservice.js

// Synchronet Service for remote sysop paging

// Example configuration (in ctrl/services.ini):

// [RazorPage]
// Port=10005
// MaxClients=5
// Command=razorpageservice.js

load("nodedefs.js");
load("sockdefs.js");
load("sbbsdefs.js");
load("portdefs.js");

var quit=false;
var debug=false;
var authenticated=false;
const pagerctrlfile=system.ctrl_dir + "sysavail.chat";

// Write a string to the client socket
function write(str)
{
	client.socket.send(str);
}

function writeln(str)
{
	if(debug)
		log("rsp: " + str);
	write(str + "\r\n");
}


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

	// all commands will start with either AUTHINFO, PAGE, CHAT, or QUIT depending on which they apply to
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
			// PAGE will receive either ENABLE or DISABLE & it will send SEND
			case "PAGE":
				if(cmd[1]==undefined)
				{
					writeln("PAGE: 500 Syntax error or unknown command");
					break;
				}
				switch(cmd[1].toUpperCase())
				{
					case "ENABLE":
						writeln("200 OK. recvd: PAGE ENABLE");
						enablepager();
						break;
					case "DISABLE":
						writeln("200 OK. recvd: PAGE DISABLE");
						disablepager();
						break;
				}
				break;

			// CHAT will receive START, MESSAGE, or STATUS & it will send MESSAGE
			case "CHAT":
				if(cmd[1]==undefined)
				{
					writeln("CHAT: 500 Syntax error or unknown command");
					break;
				}
				switch(cmd[1].toUpperCase())
				{
					case "START":
						writeln("200 OK. recvd: CHAT START");
						break;
					case "MESSAGE":
						writeln("200 OK. recvd: CHAT MESSAGE");
						break;
					case "STATUS":
						var currentstatus=getchatstatus();
						writeln(currentstatus);
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

function enablepager()
{
	// use ctrl_dir
	// should we be using file_touch() here?
	var file=new File(pagerctrlfile);
	if(!file.exists)
	{
		file.open("w");
		file.close();
		log("Page enabled");
	}
	else
	{
		log("Pager was already enabled");
	}
}

function disablepager()
{
	var file=new File(pagerctrlfile);
	if(file.exists)
	{
		file.remove();
		log("Page disabled");
	}
	else
	{
		log("Pager was already disabled");
	}
}

function getchatstatus()
{
	// get pager & node status
	// maybe chat messages from the user will be passed to the sysop client here?
	
	var separator=".";
	var nodeseparator=";";
	var statseparator=",";
	var currchatstatus="PAGER:";
	var currnodestatus="";
	if(file_exists(pagerctrlfile))
	{
		currchatstatus+="ENABLED";
	}
	else
	{
		currchatstatus+="DISABLED";
	}
	currchatstatus+=separator;
	currchatstatus+=getpagerstatus();
	currchatstatus+=separator;
	// format: NODES:nodenumber,nodestatusnumber,useron,nodestatusdescription
	currchatstatus+="NODES:";
	for(i=0; i<system.nodes; i++)
	{
		// node#
		currnodestatus=i+1 + statseparator;
		currnodestatus+=system.node_list[i].status+statseparator;
		if(system.node_list[i].status==3)
		{
			// a user is logged in
			// username
			currnodestatus+=system.username(system.node_list[i].useron) + statseparator;
			// action
			currnodestatus+=NodeAction[system.node_list[i].action];
		}
		else
		{
			// status other than user logged in
			currnodestatus+=statseparator+NodeStatus[system.node_list[i].status];
		}
		if(i<(system.nodes-1)) //if it's not the last node, add the node separator
		{
			currnodestatus+=nodeseparator;
		}
		currchatstatus+=currnodestatus;
	}
	return currchatstatus;
}

function getpagerstatus()
{
	var currentpagerstatus="";
	// Look for a semaphore file (ctrl/syspage.<node_num>) when the sysop is being paged by a user on the terminal server.
	// use file_exists() ?
	var pagefileroot=system.ctrl_dir + "syspage.";
	for(i=0; i<system.nodes; i++)
	{
		if(file_exists(pagefileroot+i))
		{
			currentpagerstatus="PAGING:"+i;
			file_remove(pagefileroot+i);
		}
	}
	
	return currentpagerstatus;
}

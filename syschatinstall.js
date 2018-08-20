// Script to be run with jsexec, adds the default config info to services.ini

// Example configuration (in ctrl/services.ini):

// [SysChat]
// Port=10005
// MaxClients=5
// Command=syschatservice.js

var servicesfile=system.ctrl_dir + "services.ini";
var syschatexists=false;
var syschatsection="SysChat";

var file=new File(servicesfile);
if(file.exists)
{
	file.open(file.exists ? 'r+':'w+');
	existingsections=file.iniGetSections();
	addsyschattoini(existingsections);
	file.close();
}

function addsyschattoini(existingsections)
{
	for(i=0; i<existingsections.length; i++)
	{
		if(existingsections[i].toLowerCase()=="syschat")
		{
			syschatexists=true;
		}
	}
	
	if(!syschatexists)
	{
		// add [SysChat] to services.ini
		file.iniSetValue(syschatsection, "Port", "10005");
		file.iniSetValue(syschatsection, "MaxClients", "5");
		file.iniSetValue(syschatsection, "Command", "syschatservice.js");
		print("[SysChat] added to services.ini");
	}
	else
	{
		print("[SysChat] already exists in services.ini");
	}
}
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {platformDataDirectory,hashPassword} from '../server/platformAccounts.mjs';
const directory=platformDataDirectory();
await mkdir(directory,{recursive:true,mode:0o700});
try{await readFile(path.join(directory,'admin.json'));console.log('Administrator already configured. Credentials are in the private local data directory.');}
catch(error){if(error.code!=='ENOENT')throw error;const email='admin@chartreplay.local';const password=randomBytes(18).toString('base64url');await writeFile(path.join(directory,'admin.json'),JSON.stringify({email,passwordHash:await hashPassword(password),sessionSecret:randomBytes(48).toString('hex')},null,2),{mode:0o600,flag:'wx'});await writeFile(path.join(directory,'admin-login.txt'),`Chart Replay — local administrator
URL: http://localhost:3001/admin
Email: ${email}
Password: ${password}

Keep this file private. The dashboard never displays user passwords.
`,{mode:0o600,flag:'wx'});console.log('Local administrator created. Login details saved outside the website at '+path.join(directory,'admin-login.txt'));}

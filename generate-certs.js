const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Create certs directory if it doesn't exist
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

const keyPath = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');

console.log('Generating self-signed certificate for local development...');

// Try to use selfsigned module if available
try {
  const selfsigned = require('selfsigned');
  
  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'US' },
    { name: 'organizationName', value: 'Slack Summarizer Development' }
  ];
  
  const pems = selfsigned.generate(attrs, { 
    days: 365,
    algorithm: 'sha256',
    keySize: 2048,
    extensions: [
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }
    ]
  });
  
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  
  console.log('✅ Successfully generated self-signed certificates using selfsigned module!');
  console.log(`Certificate saved to: ${certPath}`);
  console.log(`Private key saved to: ${keyPath}`);
  console.log('\nThese certificates are for development purposes only.');
  console.log('You will need to accept the security warning in your browser.');
} catch (err) {
  console.log('selfsigned module not found, falling back to OpenSSL or Node.js crypto...');
  
  // Try OpenSSL if available
  try {
    execSync('openssl version', { stdio: 'pipe' });
    
    // OpenSSL is available, use it to generate certs
    const opensslCmd = `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost/O=Slack Summarizer Development/C=US"`;
    
    console.log('Executing OpenSSL command...');
    execSync(opensslCmd, { stdio: 'inherit' });
    
    console.log('✅ Successfully generated self-signed certificates using OpenSSL!');
  } catch (opensslErr) {
    console.log('OpenSSL not available, using Node.js crypto module...');
    
    // Use Node.js crypto as last resort
    try {
      // Generate a self-signed certificate using Node.js crypto
      const { generateKeyPairSync } = crypto;
      
      // Generate key pair
      console.log('Generating key pair...');
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      
      // Write private key to file
      fs.writeFileSync(keyPath, privateKey);
      
      // Since we can't create a proper certificate with crypto alone,
      // we'll write the public key as a placeholder
      fs.writeFileSync(certPath, publicKey);
      
      console.log('⚠️ Generated keys using Node.js crypto module.');
      console.log('Note: This is not a proper certificate and may not work in all cases.');
      console.log('Consider installing the selfsigned npm package:');
      console.log('  npm install selfsigned --save-dev');
      
      // Instructions for installing required packages
      console.log('\n📦 Install required packages:');
      console.log('  npm install selfsigned --save-dev');
    } catch (cryptoErr) {
      console.error('Failed to generate certificates:', cryptoErr);
      process.exit(1);
    }
  }
}

console.log('\n🚀 Next steps:');
console.log('1. Run the secure server: node secure-server.js');
console.log('2. Open https://localhost:3000 in your browser');
console.log('3. Accept the security warning (this is expected for self-signed certificates)');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Secret Key Generator
 * Generates a secure random secret key for session management
 */

console.log('='.repeat(50));
console.log('Secret Key Generator');
console.log('='.repeat(50));

// Generate a secure random secret
const secret = crypto.randomBytes(64).toString('hex');

console.log('\nYour generated secret key:');
console.log('─'.repeat(50));
console.log(secret);
console.log('─'.repeat(50));

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  console.log('\n⚠️  .env file already exists');
  console.log('Please manually update SESSION_SECRET in your .env file');
} else if (fs.existsSync(envExamplePath)) {
  // Copy .env.example to .env
  const envExample = fs.readFileSync(envExamplePath, 'utf-8');
  const envContent = envExample.replace(
    'SESSION_SECRET=your-super-secret-key-here-change-this',
    `SESSION_SECRET=${secret}`
  );
  
  fs.writeFileSync(envPath, envContent);
  console.log('\n✓ .env file created with new secret key');
} else {
  console.log('\n⚠️  .env.example file not found');
  console.log('Please manually create .env file and set SESSION_SECRET');
}

console.log('\n' + '='.repeat(50));
console.log('Done! Keep this secret safe and never commit it to git.');
console.log('='.repeat(50) + '\n');

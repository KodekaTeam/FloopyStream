const readline = require('readline');
const Account = require('../models/Account');

/**
 * Password Reset Tool
 * Allows resetting user password from command line
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('='.repeat(50));
console.log('Password Reset Tool');
console.log('='.repeat(50));
console.log('');

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function resetPassword() {
  try {
    const username = await question('Enter username: ');
    
    if (!username) {
      console.log('❌ Username is required');
      rl.close();
      return;
    }

    const account = await Account.findByUsername(username);
    
    if (!account) {
      console.log(`❌ Account with username "${username}" not found`);
      rl.close();
      return;
    }

    const newPassword = await question('Enter new password: ');
    
    if (!newPassword || newPassword.length < 6) {
      console.log('❌ Password must be at least 6 characters');
      rl.close();
      return;
    }

    const confirmPassword = await question('Confirm new password: ');
    
    if (newPassword !== confirmPassword) {
      console.log('❌ Passwords do not match');
      rl.close();
      return;
    }

    await Account.updatePassword(account.account_id, newPassword);
    
    console.log('');
    console.log('✓ Password updated successfully!');
    console.log('');
    
    rl.close();
  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

resetPassword();

const fs = require('fs');
const path = require('path');

// Android icon sizes (in pixels)
const androidSizes = {
    'mipmap-mdpi': { ic_launcher: 48, ic_launcher_round: 48 },
    'mipmap-hdpi': { ic_launcher: 72, ic_launcher_round: 72 },
    'mipmap-xhdpi': { ic_launcher: 96, ic_launcher_round: 96 },
    'mipmap-xxhdpi': { ic_launcher: 144, ic_launcher_round: 144 },
    'mipmap-xxxhdpi': { ic_launcher: 192, ic_launcher_round: 192 },
    'mipmap-anydpi-v26': { adaptive: true } // Special case for adaptive icons
};

// Function to copy and resize icon (placeholder - you'll need to use an image processing library)
function generateIcons(sourceIconPath) {
    const androidResPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
    
    // Check if source icon exists
    if (!fs.existsSync(sourceIconPath)) {
        console.error('Source icon not found at:', sourceIconPath);
        console.log('Please save your icon as: public/hostelhq-icon.png');
        return;
    }
    
    console.log('Generating Android icons from:', sourceIconPath);
    
    // For now, let's copy the original to all sizes
    // In a real implementation, you'd use sharp or jimp to resize
    Object.keys(androidSizes).forEach(folder => {
        const folderPath = path.join(androidResPath, folder);
        
        if (androidSizes[folder].adaptive) {
            // Handle adaptive icons (XML files)
            console.log(`Adaptive icons needed in ${folder}`);
        } else {
            // Handle regular PNG icons
            console.log(`Creating icons in ${folder}:`);
            console.log(`  - ic_launcher.png (${androidSizes[folder].ic_launcher}px)`);
            console.log(`  - ic_launcher_round.png (${androidSizes[folder].ic_launcher_round}px)`);
            
            // Copy source icon (you should resize in real implementation)
            const targetPath = path.join(folderPath, 'ic_launcher.png');
            const targetRoundPath = path.join(folderPath, 'ic_launcher_round.png');
            
            // For now, just copy the original (you'll need to resize)
            fs.copyFileSync(sourceIconPath, targetPath);
            fs.copyFileSync(sourceIconPath, targetRoundPath);
        }
    });
    
    console.log('\n✅ Icons generated!');
    console.log('\n⚠️  Note: For production, you should resize icons to proper dimensions.');
    console.log('   Use an online tool like: https://appicon.co/');
}

// Check if icon exists and generate
const iconPath = path.join(__dirname, 'public', 'hostelhq-icon.png');
if (fs.existsSync(iconPath)) {
    generateIcons(iconPath);
} else {
    console.log('❌ Icon not found. Please save your icon as: public/hostelhq-icon.png');
}

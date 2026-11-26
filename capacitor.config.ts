import type {CapacitorConfig} from '@capacitor/cli';
const config:CapacitorConfig={appId:'com.naijacare.app',appName:'NaijaCare',webDir:'dist',
 android:{allowMixedContent:false},
 plugins:{SplashScreen:{launchShowDuration:1500,backgroundColor:'#0F2233',androidScaleType:'CENTER_CROP',showSpinner:false}}};
export default config;

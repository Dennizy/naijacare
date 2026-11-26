import React,{lazy,Suspense} from 'react';import {createRoot} from 'react-dom/client';import {Capacitor} from '@capacitor/core';
import App from './App.jsx';import './styles.css';
const Admin=lazy(()=>import('./admin/Admin.jsx'));const isAdmin=location.pathname.startsWith('/admin');
createRoot(document.getElementById('root')).render(isAdmin?<Suspense fallback={null}><Admin/></Suspense>:<App/>);
if(!isAdmin&&'serviceWorker' in navigator&&!Capacitor.isNativePlatform()&&import.meta.env.PROD)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));

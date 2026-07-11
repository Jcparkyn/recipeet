import { render } from 'solid-js/web';
import '@fontsource-variable/lora';
import '@fontsource-variable/lora/wght-italic.css';
import './index.css';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
render(() => <App />, root);

import './style.css';
import { MobileApp } from './mobile_app';

const root = document.getElementById('app');
const overlay = document.createElement('div');
overlay.id = 'overlay';
document.body.append(overlay);

if (root !== null) {
	void new MobileApp(root, overlay).start();
}

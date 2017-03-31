/* eslint no-unused-vars: 0 */
import React from 'react';
import ReactDOM from 'react-dom';
import { objectOmitPluck } from './helpers';
import Routing from './routing';
import Store from './store';
import { WSController } from './controllers/webcrypto_socket';

window.Store = Store;

const wsOnListening = () => {
  // Store.dispatch({ type: 'WS:GET_KEYS' });
  Store.dispatch({ type: 'WS:GET_CERTIFICATES' });
  Store.dispatch({ type: 'APP:ONLINE', state: true });
};

const wsOnError = (error) => {
  console.log('Connected error', error);
  Store.dispatch({ type: 'APP:ONLINE', state: false });
};

const wsOnClose = () => {
  Store.dispatch({ type: 'APP:ONLINE', state: false });
};

WSController.connect(wsOnListening, wsOnError, wsOnClose);

ReactDOM.render(<Routing />, document.getElementById('root'));

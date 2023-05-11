import React, { ErrorInfo } from 'react';
// import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min";
import './App.css';
import { BrowserRouter as Router } from "react-router-dom";
import { BROWSER_SUPPORTED_VERSIONS, TOAST_DURATION, TOAST_SUCCESS_DURATION } from './utils/Params';
import { Toaster } from 'react-hot-toast';
import MainPage from './components/MainPage';
import FooterControl from './components/FooterControl';
import HackRF from './utils/hackrf';

interface AppState {
  error: string | null;
  browserSupported: boolean;
  device: HackRF | null;
}

class App extends React.Component<{}, AppState> {
  constructor(props: any) {
    super(props);
    this.state = {
      error: null,
      browserSupported: true,
      device: null,
    };
  }

  componentDidMount(): void {
    checkIfBrowserSupported().then((supported) => {
      this.setState({
        browserSupported: supported,
      });
    });
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error: (error && error.toString()) + "<br> " + errorInfo.componentStack,
    });
    console.error(error, errorInfo);
    // Can also log error messages to an error reporting service here
  }

  async requestDevice() {
    const device = await HackRF.requestDevice();
    navigator.usb.ondisconnect = event => {
      console.log("USB device disconnected");
      this.setState({
        device: null,
      });
    };
    const hackrf = new HackRF();
    if (device) {
      await hackrf.open(device);
      this.setState({
        device: hackrf,
      });
    } else {
      this.setState({
        device: null,
      });
    }
  }

  render() {
    if (!this.state.browserSupported) {
      const browser = get_browser();
      return (
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="alert mt-5 alert-danger" role="alert">
                {browser.name ? (
                  <h4 className="alert-heading">
                    {browser.name}
                    {browser.version ? ` (${browser.version})` : ""} is not supported
                  </h4>
                ) : (
                  <h4 className="alert-heading">Browser not supported</h4>
                )}
                <p>
                  This app is only supported on {
                    Object.entries(BROWSER_SUPPORTED_VERSIONS).map(([browser, version]) => {
                      return `${browser} (${version}+)`;
                    }).join(", ")
                  }. Please use another browser.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (this.state.error) {
      return (
        <div className="container mt-5">
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: "pre-wrap" }}>
            {this.state.error}
          </details>
        </div>
      );
    }
    if (!this.state.device) {
      return (
        <div className="container mt-5">
          <h2>Connect your HackRF</h2>
          <button className="btn btn-primary" onClick={() => this.requestDevice()}>Connect</button>
        </div>
      );
    }
    return (
      <Router>
        <Toaster
          toastOptions={{
            style: {
              background: '#363636',
              color: '#fff',
            },
            duration: TOAST_DURATION,
            success: {
              duration: TOAST_SUCCESS_DURATION,
            },
          }}
        />
        <MainPage device={this.state.device} />
        <FooterControl device={this.state.device} />
      </Router>
    );
  }
}


function checkIfBrowserSupported(): Promise<boolean> {
  return new Promise((resolve) => {
    const browser = get_browser();
    for (const [key, value] of Object.entries(BROWSER_SUPPORTED_VERSIONS)) {
      if (browser.name === key && parseInt(browser.version) >= value) {
        resolve(true);
        return;
      }
    }
    resolve(false);
  });
}

function get_browser() {
  var ua = navigator.userAgent, tem, M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
  if (/trident/i.test(M[1])) {
    tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
    return { name: 'IE', version: (tem[1] || '') };
  }
  if (M[1] === 'Chrome') {
    tem = ua.match(/\bOPR|Edge\/(\d+)/)
    if (tem != null) { return { name: 'Opera', version: tem[1] }; }
    tem = ua.match(/\bBrave\/(\d+)/)
    if (tem != null) { return { name: 'Brave', version: tem[1] }; }
  }
  M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
  if ((tem = ua.match(/version\/(\d+)/i)) != null) { M.splice(1, 1, tem[1]); }
  return {
    name: M[0],
    version: M[1]
  };
}

export default App;

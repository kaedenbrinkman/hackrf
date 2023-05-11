import { Component } from "react";
import { Route, Routes } from "react-router-dom";
import HackRF from "../utils/hackrf";
import TeslaChargePortApp from "./apps/tesla-charge-port/TeslaChargePort";
import AppList from "./apps/AppList";
import ChamberlainGarageDoorApp from "./apps/chamberlain-garage-door/ChamberlainGarageDoor";
// import ADSBApp from "./apps/ads-b/ADSB";
// import BLESnifferApp from "./apps/ble-sniffer/BLESniffer";
import FMRadioApp from "./apps/fm-radio/FMRadio";
// import GSMSnifferApp from "./apps/gsm-sniffer/GSMSniffer";
// import WiFiFinderApp from "./apps/wifi-finder/WiFiFinder";
import SpectrumAnalyzerApp from "./apps/spectrum-analyzer/SpectrumAnalyzer";

interface MainPageProps {
  device: HackRF;
}
interface MainPageState {
  uploadedFiles: File[];
  error: Error | null;
}

class MainPage extends Component<MainPageProps, MainPageState> {
  constructor(props: MainPageProps) {
    super(props);
    this.state = {
      uploadedFiles: [],
      error: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error });
  }

  render() {
    if (this.state.error) {
      return (
        <main className="w-100 px-2 px-md-4 mt-5">
          <div className="alert alert-danger" role="alert">
            <h4 className="alert-heading">Oops! We ran into an error.</h4>
            <p>Message: {this.state.error.message}</p>
            <a className="btn btn-outline-primary" href="/feedback">Send feedback</a>
            <hr />
            <details style={{ whiteSpace: "pre-wrap" }}>
              {this.state.error.stack}
            </details>
          </div>
        </main>
      );
    }

    return (
      <main className="w-100 h-100 overflow-auto" style={{ maxHeight: "calc(100vh - 100px)" }}>
        <Routes>
          <Route path="/" element={<AppList />} />
          <Route path="/tesla-charge-port" element={<TeslaChargePortApp device={this.props.device} />} />
          <Route path="/chamberlain-garage-door" element={<ChamberlainGarageDoorApp device={this.props.device} />} />
          <Route path="/spectrum-analyzer" element={<SpectrumAnalyzerApp device={this.props.device} />} />
          <Route path="/fm-radio" element={<FMRadioApp device={this.props.device} />} />
          {/* <Route path="/ads-b" element={<ADSBApp device={this.props.device} />} />
          <Route path="/ble-sniffer" element={<BLESnifferApp device={this.props.device} />} />
          <Route path="/gsm-sniffer" element={<GSMSnifferApp device={this.props.device} />} /> */}
          {/* <Route path="/wifi-finder" element={<WiFiFinderApp device={this.props.device} />} /> */}
        </Routes>
      </main>
    );
  }
}

export default MainPage;
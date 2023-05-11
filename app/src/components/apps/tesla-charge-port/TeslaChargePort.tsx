import { Component } from "react";
import HackRF from "../../../utils/hackrf";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import "./TeslaChargePort.css";

interface TeslaChargePortAppProps {
  device: HackRF;
}
interface TeslaChargePortAppState {
  amplify_signal: boolean;
}

const SAMPLE_RATE = 10000000; // 10 MHz
const FREQUENCY = 315000000; // 315 MHz
const GAIN = 24; // 1 to 40 dB
let SYMBOL_RATE = 2500; // 2.5 kHz

class TeslaChargePortApp extends Component<TeslaChargePortAppProps, TeslaChargePortAppState> {
  constructor(props: TeslaChargePortAppProps) {
    super(props);
    this.state = {
      amplify_signal: false,
    };
  }

  /**
   * This function is stolen from https://github.com/rgerganov/tesla-opener
   * @returns a callback function that can be used to transmit the signal
   */
  private makeTxCallback() {
    let PATTERN = [0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1];
    const samplesPerBit = SAMPLE_RATE / SYMBOL_RATE;
    const total = PATTERN.length * samplesPerBit;
    console.log(`total=${total}`);
    let offset = 0;
    return function (length: any) {
      console.log(`offset=${offset} lenght=${length}`);
      // send the pattern 5 times
      if (offset < 5 * total) {
        let buf = new Int8Array(length);
        for (let i = 0; i < length / 2; i++) {
          let ind = Math.floor(offset / samplesPerBit) % PATTERN.length;
          buf[i * 2] = (PATTERN[ind] === 0) ? 0 : 127;
          buf[i * 2 + 1] = 0;
          offset++;
        }
        return buf;
      } else {
        return null;
      }
    }
  }

  async transmitSignal() {
    await this.props.device.setAmpEnable(this.state.amplify_signal);
    await this.props.device.setAntennaEnable(false);
    await this.props.device.setFreq(FREQUENCY);
    await this.props.device.setSampleRateManual(SAMPLE_RATE, 1);
    await this.props.device.setTxVgaGain(GAIN);
    const txCallback = this.makeTxCallback();
    const transmission = this.props.device.startTx(txCallback);
    toast.promise(transmission, {
      loading: 'Transmitting...',
      success: 'Transmission complete',
      error: 'Transmission failed',
    });
    await transmission;
  }

  render() {
    return (
      <div className="p-3 h-100">
        <div className="tesla-charge-port-bg" />
        <div className="content">
          <Link to="/">{"< "}Back</Link>
          <h1>Tesla Charge Port</h1>
          <p>
            This app will transmit a signal that will open the charge port on a
            Tesla Model 3/Y.
          </p>
          <p>
            Pattern and transmission code adapted from{" "}
            <a className="text-white" href="https://github.com/rgerganov/tesla-opener" target="_blank" rel="noopener noreferrer">
              https://github.com/rgerganov/tesla-opener
            </a>
          </p>
          <p>
            <button onClick={() => this.transmitSignal()}>Open Charge Port</button>
          </p>
          <p>
            <input type="checkbox" checked={this.state.amplify_signal} onChange={() => this.setState({ amplify_signal: !this.state.amplify_signal })} /> Amplify Signal
          </p>
        </div>
      </div>
    );
  }
}

export default TeslaChargePortApp;
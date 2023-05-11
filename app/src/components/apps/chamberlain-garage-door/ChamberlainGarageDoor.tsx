import { Component } from "react";
import HackRF from "../../../utils/hackrf";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import "./ChamberlainGarageDoor.css";
import { bitsToHex, bytes2iq, convolve, convolveN } from "../../../utils/signal";
import React from "react";
import { Complex, fft } from "../../../utils/FFT";

interface ChamberlainGarageDoorAppProps {
  device: HackRF;
}
interface ChamberlainGarageDoorAppState {
  amplify_signal: boolean;
  mode: "Security+" | "Security+ 2.0";
  rolling_code: number;
  fixed_code: number;
  receivedHex: string;
}

const SAMPLE_RATE = 2.4e6; // 2.4 MHz
const FREQUENCY = 310e6; // 310 MHz
const GAIN = 40; // 1 to 40 dB
let SYMBOL_RATE = 2500; // 2.5 kHz

const SYMBOL_WIDTH = 620; // samples per symbol

class ChamberlainGarageDoorApp extends Component<ChamberlainGarageDoorAppProps, ChamberlainGarageDoorAppState> {
  constructor(props: ChamberlainGarageDoorAppProps) {
    super(props);
    this.state = {
      amplify_signal: false,
      mode: "Security+ 2.0",
      rolling_code: 0,
      fixed_code: 0,
      receivedHex: ""
    };
    this.graphRef = React.createRef();
    this.samples = [];
    this.checksSinceLastDetection = 0;
  }

  private graphRef: React.RefObject<HTMLCanvasElement>;
  private samples: (0 | 1)[] = [];
  private dataBuffer: Complex[] = [];
  private checksSinceLastDetection: number;

  componentDidMount() {
    this.readSamples();
  }

  componentWillUnmount() {
    this.props.device.stopRx();
  }

  private makeTxCallback(rollingCode: number) {
    const samplesPerBit = SAMPLE_RATE / SYMBOL_RATE;
    const data = ChamberlainGarageDoorApp.encode(rollingCode, 0);
    const total = data.length * samplesPerBit;
    console.log(`total=${total}`);
    let offset = 0;
    return function (length: any) {
      console.log(`offset=${offset} lenght=${length}`);
      // send the pattern 5 times
      if (offset < 5 * total) {
        let buf = new Int8Array(length);
        for (let i = 0; i < length / 2; i++) {
          let ind = Math.floor(offset / samplesPerBit) % data.length;
          buf[i * 2] = (data[ind] === 0) ? 0 : 127;
          buf[i * 2 + 1] = 0;
          offset++;
        }
        return buf;
      } else {
        return null;
      }
    }
  }

  // Based on https://github.com/argilo/secplus/

  static encode(rolling: number, fixed: number): number[] {
    if (rolling >= 2 ** 32) {
      throw new Error("Rolling code must be less than 2^32");
    }
    if (fixed >= 3 ** 20) {
      throw new Error("Fixed code must be less than 3^20");
    }

    rolling = parseInt(`${(rolling & 0xfffffffe).toString(2).padStart(32, "0")}`.split("").reverse().join(""), 2);
    const rollingBase3 = Array(20).fill(0);
    const fixedBase3 = Array(20).fill(0);
    for (let i = 19; i >= 0; i--) {
      rollingBase3[i] = rolling % 3;
      rolling = Math.floor(rolling / 3);
      fixedBase3[i] = fixed % 3;
      fixed = Math.floor(fixed / 3);
    }
    const code: number[] = [];
    for (let i = 0; i < 20; i++) {
      let acc = 0;
      if (i === 0 || i === 10) {
        acc = 0;
      }
      acc += rollingBase3[i];
      code.push(rollingBase3[i]);
      acc += fixedBase3[i];
      code.push(acc % 3);
    }
    return code;
  }

  static decode(code: number[]): [number, number] {
    let rolling = 0;
    let fixed = 0;

    for (let i = 0; i < 40; i += 2) {
      let acc = 0;
      if (i === 0 || i === 20) {
        acc = 0;
      }

      const digit = code[i];
      rolling = (rolling * 3) + digit;
      acc += digit;

      const nextDigit = (code[i + 1] - acc) % 3;
      fixed = (fixed * 3) + nextDigit;
      acc += nextDigit;
    }

    rolling = parseInt(`${rolling.toString(2).padStart(32, "0")}`.split("").reverse().join(""), 2);
    return [rolling, fixed];
  }

  async transmitSignal() {
    await this.props.device.setAmpEnable(this.state.amplify_signal);
    await this.props.device.setAntennaEnable(false);
    await this.props.device.setFreq(FREQUENCY);
    await this.props.device.setSampleRateManual(SAMPLE_RATE, 1);
    await this.props.device.setTxVgaGain(GAIN);
    const txCallback = this.makeTxCallback(0);
    const transmission = this.props.device.startTx(txCallback);
    toast.promise(transmission, {
      loading: 'Transmitting...',
      success: 'Transmission complete',
      error: 'Transmission failed',
    });
    await transmission;
  }

  async readSamples() {
    await this.props.device.setFreq(FREQUENCY);
    await this.props.device.setSampleRateManual(SAMPLE_RATE, 1);
    await this.props.device.setVgaGain(40);
    await this.props.device.setLnaGain(14);
    this.props.device.startRx(async (data: Uint8Array) => {
      const samples = bytes2iq(data);
      const freqData = fft(samples);
      // cut off the first 1000 samples (which are the DC offset)
      freqData.splice(0, 1000);
      const maxFreq = freqData.reduce((max, x) => Math.max(max, x.magnitude), 0);
      // console.log(`maxFreq=${maxFreq}`, freqData.length);
      if (maxFreq < 1000) {
        if (this.checksSinceLastDetection !== -1) {
          this.checksSinceLastDetection++;
          if (this.checksSinceLastDetection >= 15) {
            this.checksSinceLastDetection = -1;
            this.processSamples();
            // check for detections in this.samples
            const detections = this.samples.filter((x) => x === 1).length;
            if (detections > 100) {
              console.log("packet detected");
              this.handleData();
            }
          }
        }
        // no signal, do no further processing
        return;
      }
      this.checksSinceLastDetection = 0;
      this.dataBuffer = this.dataBuffer.concat(samples);
    }, SAMPLE_RATE / 100);
  }

  processSamples() {
    const samples = this.dataBuffer;
    this.dataBuffer = [];
    const boxcar = Array(100).fill(1 / 100);
    const smoothedSamples = convolveN(samples.map((x) => x.magnitude), boxcar);
    // const smoothedSamples = convolve(samples, boxcar);

    let maxSample = 0;
    let sum = 0;
    for (let i = 0; i < smoothedSamples.length; i++) {
      maxSample = Math.max(maxSample, smoothedSamples[i]);
      sum += smoothedSamples[i];
    }
    const avgSample = sum / smoothedSamples.length;
    console.log(`maxSample=${maxSample}`);
    console.log(`avgSample=${avgSample}`);

    const demodulatedData = smoothedSamples.map((x) => x > avgSample * 1.01 ? 1 : 0);

    this.samples = this.samples.concat(demodulatedData);
    if (this.samples.length > SYMBOL_WIDTH * 300) {
      this.samples = this.samples.slice(SYMBOL_WIDTH * -300);
    }
    this.drawSawtooth();
  }

  drawSawtooth() {
    const graphCanvas = this.graphRef.current;
    const graphCtx = graphCanvas?.getContext('2d');
    if (!graphCtx || !graphCanvas) return;

    const width = graphCanvas.width;
    const height = graphCanvas.height - 40; // 40 px for padding

    // Set the background color to black
    graphCtx.fillStyle = 'black';
    graphCtx.fillRect(0, 0, width, height);

    // Set the line color to green
    graphCtx.strokeStyle = 'green';

    // Draw the sawtooth signal
    graphCtx.beginPath();
    graphCtx.moveTo(0, height / 2);
    for (let i = 0; i < this.samples.length; i++) {
      const x = (i / this.samples.length) * width;
      const y = (height / 2) - this.samples[i] * (height / 2) + 20;
      graphCtx.lineTo(x, y);
    }
    graphCtx.stroke();
  }

  handleData() {
    const samples = this.samples.concat([]);

    let detectedBits: { bit: (1 | 0), count: number }[] = [];

    let last: (0 | 1) = samples[0];
    let count = 0;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i] === last) {
        count++;
      } else {
        detectedBits.push({ bit: last, count });
        console.log({ bit: last, count });
        last = samples[i];
        count = 1;
      }
    }
    detectedBits.push({ bit: last, count });
    console.log({ bit: last, count });

    // remove any bits with count less than SYMBOL_WIDTH/2
    detectedBits = detectedBits.filter((x) => x.count >= SYMBOL_WIDTH / 2);
    // combine adjacent bits
    for (let i = 1; i < detectedBits.length; i++) {
      if (detectedBits[i].bit === detectedBits[i - 1].bit) {
        detectedBits[i].count += detectedBits[i - 1].count;
        detectedBits.splice(i - 1, 1);
        i--;
      }
    }
    // Split into multiple packets if any bits are more than 10 times SYMBOL_WIDTH
    const packets = [];
    let packet = [];
    for (let i = 0; i < detectedBits.length; i++) {
      packet.push(detectedBits[i]);
      if (detectedBits[i].count > SYMBOL_WIDTH * 10 && detectedBits[i].bit === 0) {
        packets.push(packet);
        packet = [];
      }
    }
    packets.push(packet);

    // duplicate each bit count/symbol_width times and only keep the bit
    for (let i = 0; i < packets.length; i++) {
      const packet: any[] = packets[i];
      const newPacket = [];
      for (let j = 0; j < packet.length; j++) {
        const bit: (0 | 1) = packet[j].bit;
        const count = packet[j].count;
        for (let k = 0; k < count / SYMBOL_WIDTH; k++) {
          newPacket.push({ bit });
        }
      }
      packets[i] = newPacket;
    }

    // hack: remove all 1s from the beginning of the packet
    // for (let i = 0; i < packets.length; i++) {
    //   const packet: any[] = packets[i];
    //   while (packet.length >= 2 && packet[0].bit === 1 && packet[1].bit === 1) {
    //     packet.shift();
    //   }
    // }

    // convert each packet to hex
    const hexPackets = packets.map((p) => bitsToHex(p.map((x) => x.bit)));
    console.log(hexPackets);
    this.setState({ receivedHex: hexPackets.join(" ") });
  }

  render() {
    return (
      <div className="p-3 h-100" >
        <div className="chamberlain-bg" />
        <div className="content">
          <Link to="/">{"< "}Back</Link>
          <h1>Chamberlain Garage Door</h1>
          <p>
            This app will transmit a signal that will open a Chamberlain garage door.
          </p>
          <p>
            It is also currently listening for signals in the 315 MHz range. If a signal is detected, the decoded message will be displayed below.
          </p>
          <p>
            <select value={this.state.mode} onChange={(e) => this.setState({ mode: e.target.value as "Security+" | "Security+ 2.0" })}>
              <option value="Security+">Security+</option>
              <option value="Security+ 2.0">Security+ 2.0</option>
            </select>
          </p>
          <p>
            <input type="number" min="0" value={this.state.rolling_code} onChange={(e) => this.setState({ rolling_code: parseInt(e.target.value) })} /> Rolling Code
          </p>
          <p>
            <input type="number" min="0" value={this.state.fixed_code} onChange={(e) => this.setState({ fixed_code: parseInt(e.target.value) })} /> Fixed Code
          </p>
          <p>
            <input type="checkbox" checked={this.state.amplify_signal} onChange={() => this.setState({ amplify_signal: !this.state.amplify_signal })} /> Amplify Signal
          </p>
          <p>
            <button onClick={() => this.transmitSignal()}>Transmit Signal</button>
          </p>
          <canvas ref={this.graphRef} width="1000" height="200" />
          <p>
            Received Hex: <code>{this.state.receivedHex}</code>
          </p>
        </div>
      </div>
    );
  }
}

export default ChamberlainGarageDoorApp;
import { Component } from "react";
import HackRF from "../../../utils/hackrf";
import { Link } from "react-router-dom";
import "./FMRadio.css";
import { Complex, fft, fftshift, ifft } from "../../../utils/FFT";
import { bandpass, bytes2iq, convolve, firwin, fmDemodulate } from "../../../utils/signal";

interface FMRadioAppProps {
    device: HackRF;
}
interface FMRadioAppState {
    frequency: number;
}

class FMRadioApp extends Component<FMRadioAppProps, FMRadioAppState> {
    constructor(props: FMRadioAppProps) {
        super(props);
        this.state = {
            // Start at KUOW (94.9 MHz)
            frequency: 94900000,
        };
    }

    componentDidMount() {
        // this.readSamples();
    }

    componentWillUnmount() {
        this.props.device.stopRx();
    }

    async readSamples() {
        const SAMPLE_RATE = 2 * 256 * 256 * 16;
        const PLAYBACK_RATE = 48e3;
        const CUTOFF_FREQ = 100000;
        await this.props.device.setFreq(this.state.frequency);
        await this.props.device.setSampleRateManual(SAMPLE_RATE, 1);
        this.props.device.startRx((data: Uint8Array) => {
            const samples = bytes2iq(data);

            // const spectrum = fftshift(fft(samples));
            // const filteredSpectrum = bandpass(spectrum, SAMPLE_RATE, CUTOFF_FREQ);
            // const filtered_samples = ifft(filteredSpectrum);

            const fir_filter_coeffs = firwin(101, CUTOFF_FREQ, SAMPLE_RATE);
            const filtered_samples = convolve(samples, fir_filter_coeffs);

            const demodulatedData = fmDemodulate(filtered_samples);
            console.log(demodulatedData);

            const dsf = Math.floor(SAMPLE_RATE / PLAYBACK_RATE);
            const downsampled = demodulatedData.filter((_, i) => i % dsf === 0);

            this.playbackSamples(downsampled);
        }, SAMPLE_RATE / 1);
    }

    async playbackSamples(samples: number[] = []) {
        const PLAYBACK_RATE = 48e3;
        console.log(samples.length / PLAYBACK_RATE + " seconds of audio");
        const audioContext = new AudioContext();
        const buffer = audioContext.createBuffer(1, samples.length, PLAYBACK_RATE);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
            channelData[i] = samples[i];
        }
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();

        return new Promise<void>((resolve) => {
            source.onended = () => {
                audioContext.close();
                resolve();
            };
        });
    }


    render() {
        return (
            <div className="p-3 h-100">
                <div className="fm-radio-bg" />
                <div className="content">
                    <Link to="/">{"< "}Back</Link>
                    <h1>FM Radio</h1>
                    <p>
                        This app can stream FM radio from 87.5 MHz to 108 MHz. It uses the HackRF's built-in R820T2 tuner.
                    </p>
                    <p>
                        <input type="number" min="87.5" max="108.0" step="0.1" value={this.state.frequency / 1000000} onChange={(e) => {
                            let val = parseFloat(e.target.value);
                            if (val < 87.5) {
                                val = 87.5;
                            } else if (val > 108.0) {
                                val = 108.0;
                            }
                            this.setState({ frequency: val * 1000000 });
                            this.props.device.setFreq(val * 1000000);
                        }} /> MHz
                    </p>
                </div>
            </div>
        );
    }
}

export default FMRadioApp;
import { Component } from "react";
import HackRF from "../../../utils/hackrf";
import { Link } from "react-router-dom";
import React from "react";
import { Complex, fft, fftshift } from "../../../utils/FFT";
import { bytes2iq } from "../../../utils/signal";

interface SpectrumAnalyzerAppProps {
    device: HackRF;
}
interface SpectrumAnalyzerAppState {
    frequency: number;
    data: number[];
}

const SAMPLE_RATE = 5e6;

class SpectrumAnalyzerApp extends Component<SpectrumAnalyzerAppProps, SpectrumAnalyzerAppState> {
    constructor(props: SpectrumAnalyzerAppProps) {
        super(props);
        this.state = {
            frequency: 315000000,
            data: []
        };
        this.graphRef = React.createRef();
        this.histRef = React.createRef();
    }

    private graphRef: React.RefObject<HTMLCanvasElement>;
    private histRef: React.RefObject<HTMLCanvasElement>;

    private data: number[] = [];
    private maxValue = 5;

    initializeChart() {
        setInterval(() => {
            this.setState({ data: this.data });
        }, 1000);
    }

    componentDidMount() {
        this.initializeChart();
        this.readSamples();
    }

    componentWillUnmount() {
        this.props.device.stopRx();
    }

    async readSamples() {
        await this.props.device.setFreq(this.state.frequency);
        await this.props.device.setSampleRateManual(SAMPLE_RATE, 1);
        await this.props.device.setVgaGain(40);
        await this.props.device.startRx((data: Uint8Array) => {
            const samples = bytes2iq(data);
            // console.log(samples);
            const freqData = fft(samples);
            // console.log(freqData);
            this.loadData(freqData);
        }, SAMPLE_RATE / 1000);
    }

    loadData(data: Complex[]) {
        const shiftedData = fftshift(data);
        const graphCanvas = this.graphRef.current;
        const histCanvas = this.histRef.current;
        const graphCtx = graphCanvas?.getContext('2d');
        const histCtx = histCanvas?.getContext('2d');
        if (!graphCtx || !histCtx || !graphCanvas || !histCanvas) return;


        // LOAD GRAPH
        // set color to white
        graphCtx.fillStyle = 'black';
        graphCtx.strokeStyle = 'green';
        graphCtx.beginPath();
        graphCtx.fillRect(0, 0, graphCanvas.width, graphCanvas.height);
        /* draw the frequency plot, scaled to the canvas dimensions */
        const NUM_BINS = data.length;
        for (let x = 0; x < NUM_BINS; x++) {

            /* get the canvas-scaled (x, y) values for this bin */
            let x2 = ((x + NUM_BINS / 2) % NUM_BINS) * graphCanvas.width / NUM_BINS;
            let y2 = graphCanvas.height - ((100 + data[x].magnitude / this.maxValue) * (graphCanvas.height / this.maxValue / 100));

            if (x === 0 || x === NUM_BINS / 2) { graphCtx.moveTo(x2, y2); }
            graphCtx.lineTo(x2, y2);
        }
        graphCtx.stroke();


        // LOAD HIST GRAPH
        // Only store the last 500 lines
        const imageData = histCtx.getImageData(0, 0, histCanvas.width, histCanvas.height - 1);
        histCtx.clearRect(0, 0, histCanvas.width, histCanvas.height);
        histCtx.putImageData(imageData, 0, 1);

        // Draw new line
        const lineData = histCtx.createImageData(histCanvas.width, 1);
        const linePixels = lineData.data;

        // reduce pixel count so it fits in the canvas
        const pixelCount = Math.floor(shiftedData.length / histCanvas.width);
        const reducedData = [];
        for (let i = 0; i < shiftedData.length; i += pixelCount) {
            reducedData.push(shiftedData[i]);
        }

        for (let i = 0; i < reducedData.length; i++) {
            const d = reducedData[i];
            const color = this.getColor(d.magnitude / 100);

            linePixels[i * 4] = color.r;     // Red
            linePixels[i * 4 + 1] = color.g; // Green
            linePixels[i * 4 + 2] = color.b; // Blue
            linePixels[i * 4 + 3] = 255;     // Alpha
        }

        histCtx.putImageData(lineData, 0, 0);
    }

    /**
     * Returns a color from green (low) to red (high)
     * @param magnitude the data point from 0 to 1
     * @returns the color
     */
    private getColor(magnitude: number) {
        const minMagnitude = 0;
        const maxMagnitude = this.maxValue;

        // convert to decibels
        // magnitude = 10 * Math.log10(magnitude);

        // Calculate the normalized value between 0 and 1
        const normalizedValue = (magnitude - minMagnitude) / (maxMagnitude - minMagnitude);

        // Calculate the RGB components based on the normalized value
        const r = Math.floor(255 * (normalizedValue));
        const g = Math.floor(255 * (1 - normalizedValue));
        const b = 0;

        return {
            r: Math.min(r, 255),
            g: Math.min(g, 255),
            b: Math.min(b, 255)
        };
    }

    getFrequency(freq?: number) {
        if (!freq) freq = this.state.frequency;
        const units = ["Hz", "kHz", "MHz", "GHz"];
        let unitIndex = 0;
        while (freq > 1000) {
            freq /= 1000;
            unitIndex++;
        }
        return freq.toFixed(2) + " " + units[unitIndex];
    }

    render() {
        const NYQUIST = SAMPLE_RATE / 2;
        return (
            <div className="p-3 h-100 bg-dark card text-white w-100">
                <div className="spectrum-bg" />
                <div className="content p-3">
                    <Link to="/">{"< "}Back</Link>
                    <h1>RF Spectrum Analyzer</h1>
                    <p>
                        <input type="number" value={this.state.frequency} onChange={(e) => {
                            this.setState({ frequency: parseInt(e.target.value) });
                            this.props.device.setFreq(parseInt(e.target.value));
                        }} />
                    </p>
                    <p>
                        Current frequency: {this.getFrequency()}
                    </p>
                    <canvas ref={this.graphRef} width="1000" height="200" />
                    <div className="d-flex justify-content-between" style={{ width: "1000px" }}>
                        <span>{this.getFrequency(this.state.frequency - NYQUIST)}</span>
                        <span>{this.getFrequency()}</span>
                        <span>{this.getFrequency(this.state.frequency + NYQUIST)}</span>
                    </div>
                    <canvas ref={this.histRef} width="1000" height="200" />
                </div>
            </div >
        );
    }
}

export default SpectrumAnalyzerApp;
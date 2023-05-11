import { Complex } from "./FFT";


export function convolve(x: Complex[], y: Complex[]): Complex[] {
    const N = x.length;
    const M = y.length;
    const result = new Array(N + M - 1).fill(Complex.ZERO);

    for (let n = 0; n < N; n++) {
        for (let m = 0; m < M; m++) {
            result[n + m] = result[n + m].add(x[n].mul(y[m]));
        }
    }

    return result;
}

export function convolveN(a: number[], b: number[]): number[] {
    const result = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            result[i + j] += a[i] * b[j];
        }
    }
    return result;
}

export function findSymbolWidths(samples: number[]) {
    const autocorrelation = new Array(samples.length).fill(0);
    for (let i = 0; i < samples.length; i++) {
        for (let j = 0; j < samples.length - i; j++) {
            autocorrelation[i] += samples[j] * samples[j + i];
        }
    }

    const peaks = [];
    for (let i = 1; i < autocorrelation.length - 1; i++) {
        if (autocorrelation[i] > autocorrelation[i - 1] && autocorrelation[i] > autocorrelation[i + 1]) {
            peaks.push(i);
        }
    }

    const symbolWidths = [];
    for (let i = 1; i < peaks.length; i++) {
        symbolWidths.push(peaks[i] - peaks[i - 1]);
    }

    return symbolWidths;
}

export function bitsToHex(bits: (0 | 1)[]) {
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
        const nibble = bits.slice(i, i + 4).join('');
        hex += parseInt(nibble, 2).toString(16);
    }
    return hex;
}

/**
 * Convert the raw bytes received from the HackRF to an array of complex numbers
 * @param data Raw bytes received from the HackRF
 * @returns Samples as complex numbers
 */

// struct record {
//     uint32_t record_length; // 4 bytes
//     uint64_t band_lower_edge_hz; // 8 bytes
//     uint64_t band_upper_edge_hz; // 8 bytes
//     float fft_data[length]; // 4 bytes each
// }

export function bytes2iq(buffer: Uint8Array): Complex[] {
    const iq: Complex[] = [];

    // convert from 8-bit samples to complex numbers
    for (let i = 0; i < buffer.length; i += 2) {
        const I = (buffer[i] - 127) / 127;
        const Q = (buffer[i + 1] - 127) / 127;
        iq.push(new Complex(I, Q));
    }
    return iq;
}

export function goertzel(samples: Complex[], targetFrequency: number, sampleRate: number): number[] {
    const N = samples.length;
    const k = Math.round((N * targetFrequency) / sampleRate);
    const omega = (2 * Math.PI * k) / N;
    const sine = new Complex(Math.sin(omega), 0);
    const cosine = new Complex(Math.cos(omega), 0);
    let q0 = new Complex(0, 0);
    let q1 = new Complex(0, 0);
    let q2 = new Complex(0, 0);
    const amplitudes = [];
    for (let i = 0; i < N; i++) {
        q0 = samples[i].add(cosine.mul(q1)).sub(q2);
        q2 = q1;
        q1 = q0;
        const real = q1.sub(q2.mul(cosine));
        const imag = q2.mul(sine);
        const amplitude = Math.sqrt(real.real * real.real + imag.real * imag.real);
        amplitudes.push(amplitude);
    }
    return amplitudes;
}

export function fmDemodulate(samples: Complex[]): number[] {
    const fc = 200e3; // carrier frequency
    const kf = 75e3; // frequency deviation constant
    const dt = 1 / 256 / 256 / 16; // sample time

    let phase = 0;
    let freq = 0;
    let prevSample = samples[0].magnitude;
    const demodulated = [];

    for (let i = 1; i < samples.length; i++) {
        const sample = samples[i].magnitude;
        const delta = sample - prevSample;
        prevSample = sample;

        freq += kf * delta - 2 * Math.PI * fc * phase;
        phase += freq * dt;

        demodulated.push(freq);
    }

    return demodulated;
}

export function firwin(numtaps: number, cutoff: number, fs: number): Complex[] {
    const odd = numtaps % 2 !== 0;
    const M = odd ? (numtaps - 1) / 2 : numtaps / 2;
    const wc = (2 * Math.PI * cutoff) / fs;
    const h = new Array(numtaps);

    for (let n = 0; n < numtaps; n++) {
        const diff = n - M;
        if (diff === 0) {
            h[n] = new Complex(wc / Math.PI, 0);
        } else {
            h[n] = new Complex(Math.sin(wc * diff) / (Math.PI * diff), 0);
        }
        h[n].mul(0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (numtaps - 1)));
    }

    return h;
}

export function bandpass(x: Complex[], fs: number, cutoff: number): Complex[] {
  const N = x.length;
  const X = new Array(N);

  // compute frequency vector
  const f = new Array(N);
  for (let n = 0; n < N; n++) {
    f[n] = (n - N / 2) * (fs / N);
  }

  // create bandpass filter
  const h = new Array(N);
  for (let n = 0; n < N; n++) {
    if (Math.abs(f[n]) <= cutoff) {
      h[n] = new Complex(1, 0);
    } else {
      h[n] = new Complex(0, 0);
    }
  }

  // apply filter
  for (let n = 0; n < N; n++) {
    X[n] = x[n].mul(h[n]);
  }

  return X;
}
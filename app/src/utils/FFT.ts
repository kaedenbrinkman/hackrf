/**
 * Performs the Fast Fourier Transform (FFT) on the given array of complex numbers.
 * @param x - The input array of complex numbers.
 * @returns The array of complex numbers after performing the FFT.
 */

export function fft(x: Complex[]): Complex[] {
    const N = x.length;

    // base case
    if (N === 1) {
        return [x[0]];
    }

    // radix 2 Cooley-Tukey FFT
    if (N % 2 !== 0) {
        return fft(padWithZeros(x));
    }

    const even = fft(x.filter((_, i) => i % 2 === 0));
    const odd = fft(x.filter((_, i) => i % 2 !== 0));

    const result = [];
    for (let k = 0; k < N / 2; k++) {
        const t = odd[k].mul(Complex.fromPolar(1, -2 * Math.PI * k / N));
        result[k] = even[k].add(t);
        result[k + N / 2] = even[k].sub(t);
    }

    return result;
}

export function ifft(x: Complex[]): Complex[] {
    const N = x.length;
    const X = new Array(N);

    // take conjugate of input
    for (let n = 0; n < N; n++) {
        X[n] = new Complex(x[n].real, -x[n].imag);
    }

    // compute forward FFT
    const Y = fft(X);

    // take conjugate and scale
    for (let n = 0; n < N; n++) {
        Y[n] = new Complex(Y[n].real, -Y[n].imag).mul(1 / N);
    }

    return Y;
}

function padWithZeros(x: Complex[]): Complex[] {
    const N = x.length;
    const padded = new Array<Complex>(N + 1);
    for (let i = 0; i < N; i++) {
        padded[i] = x[i];
    }
    padded[N] = Complex.ZERO;
    return padded;
}

export function fftshift(x: Complex[]): Complex[] {
    const N = x.length;
    const k = Math.floor((N + 1) / 2);
    return [...x.slice(k), ...x.slice(0, k)];
}

/**
 * Represents a complex number with real and imaginary parts.
 */
export class Complex {
    constructor(public real: number, public imag: number) {
        this.real = real;
        this.imag = imag;
        this.magnitude = Math.sqrt(real * real + imag * imag);
    }

    magnitude: number;

    /**
     * Adds another complex number to this complex number.
     * @param c - The complex number to add.
     * @returns The sum of the two complex numbers.
     */
    add(c: Complex): Complex {
        return new Complex(this.real + c.real, this.imag + c.imag);
    }

    /**
     * Subtracts another complex number from this complex number.
     * @param c - The complex number to subtract.
     * @returns The difference between the two complex numbers.
     */
    sub(c: Complex): Complex {
        return new Complex(this.real - c.real, this.imag - c.imag);
    }

    /**
     * Multiplies a number (complex or regular) with this complex number.
     * @param c - The number to multiply.
     * @returns The product of the two complex numbers.
     */
    mul(other: Complex | number): Complex {
        if (typeof other === "number") {
            return new Complex(this.real * other, this.imag * other);
        } else {
            const real = this.real * other.real - this.imag * other.imag;
            const imag = this.real * other.imag + this.imag * other.real;
            return new Complex(real, imag);
        }
    }

            phase() {
            return Math.atan2(this.imag, this.real);
    }

    div(other: Complex | number): Complex {
        if (typeof other === "number") {
            return new Complex(this.real / other, this.imag / other);
        } else {
            const denominator = other.real * other.real + other.imag * other.imag;
            const real = (this.real * other.real + this.imag * other.imag) / denominator;
            const imag = (this.imag * other.real - this.real * other.imag) / denominator;
            return new Complex(real, imag);
        }
    }

    conjugate() {
        return new Complex(this.real, -this.imag);
    }

    static fromPolar(magnitude: number, phase: number) {
        return new Complex(magnitude * Math.cos(phase), magnitude * Math.sin(phase));
    }

    static ZERO = new Complex(0, 0);
}
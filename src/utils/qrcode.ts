import QRCode from 'qrcode';

export const generateQRCode = async (data: string): Promise<string> => {
  const dataUrl = await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
    width: 300,
  });
  return dataUrl;
};

export const generateQRCodeBuffer = async (data: string): Promise<Buffer> => {
  const buffer = await QRCode.toBuffer(data, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
    width: 300,
  });
  return buffer;
};

export const generateQRCodeSVG = async (data: string): Promise<string> => {
  const svg = await QRCode.toString(data, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
    width: 300,
  });
  return svg;
};

export default { generateQRCode, generateQRCodeBuffer, generateQRCodeSVG };

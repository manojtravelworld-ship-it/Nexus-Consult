// @ts-ignore
import alawmulaw from 'alawmulaw';

export function decodeTwilioAudio(base64Payload: string): string {
  // Twilio sends base64 encoded mu-law 8kHz
  const buffer = Buffer.from(base64Payload, 'base64');
  const uint8Array = new Uint8Array(buffer);
  
  // Decode to 16-bit PCM 8kHz
  const pcm16Array = alawmulaw.mulaw.decode(uint8Array);
  
  // Upsample 8kHz to 16kHz by duplicating each sample
  const upsampled = new Int16Array(pcm16Array.length * 2);
  for (let i = 0; i < pcm16Array.length; i++) {
    upsampled[i * 2] = pcm16Array[i];
    upsampled[i * 2 + 1] = pcm16Array[i];
  }
  
  // Convert back to base64
  const outBuffer = Buffer.from(upsampled.buffer);
  return outBuffer.toString('base64');
}

export function encodeTwilioAudio(base64Payload: string): string {
  // Gemini sends base64 encoded 16-bit PCM 24kHz
  const buffer = Buffer.from(base64Payload, 'base64');
  const pcm16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
  
  // Downsample 24kHz to 8kHz by taking every 3rd sample
  const downsampled = new Int16Array(Math.floor(pcm16Array.length / 3));
  for (let i = 0; i < downsampled.length; i++) {
    downsampled[i] = pcm16Array[i * 3];
  }
  
  // Encode to mu-law
  const mulawArray = alawmulaw.mulaw.encode(downsampled);
  
  // Convert back to base64
  const outBuffer = Buffer.from(mulawArray.buffer);
  return outBuffer.toString('base64');
}

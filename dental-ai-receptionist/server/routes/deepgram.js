import express from 'express';
import { createClient } from '@deepgram/sdk';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Text-to-Speech endpoint
router.post('/tts', async (req, res) => {
  try {
    const { text, voice = 'aura-asteria-en' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`TTS request for: "${text.substring(0, 50)}..." with voice: ${voice}`);

    // Female voices to try in order
    const femaleVoices = [
      'aura-asteria-en',   // Young female
      'aura-luna-en',      // Expressive female  
      'aura-stella-en',    // Professional female
      'aura-athena-en',    // Mature female
    ];

    let audioData = null;
    let selectedVoice = voice;

    // Try each voice until one works
    for (const voiceOption of femaleVoices) {
      try {
        selectedVoice = voiceOption;
        const response = await deepgram.speak.request(
          { text },
          {
            model: voiceOption,
            encoding: 'linear16',
            container: 'wav',
            sample_rate: 24000
          }
        );

        const stream = await response.getStream();
        if (stream) {
          const reader = stream.getReader();
          const chunks = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }

          // Combine chunks into single buffer
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          audioData = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            audioData.set(chunk, offset);
            offset += chunk.length;
          }

          console.log(`Successfully generated audio with ${voiceOption}`);
          break;
        }
      } catch (error) {
        console.log(`Voice ${voiceOption} failed:`, error.message);
        continue;
      }
    }

    if (!audioData) {
      throw new Error('Failed to generate audio with all voice options');
    }

    // Send audio as response
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioData.length,
      'X-Voice-Used': selectedVoice
    });
    
    res.send(Buffer.from(audioData));
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

export default router;
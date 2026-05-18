import { Global, Module } from '@nestjs/common';
import { SpeechService } from './speech.service';

@Global()
@Module({
  providers: [SpeechService],
  exports: [SpeechService],
})
export class SpeechModule {}

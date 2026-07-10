import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CHANNEL_PROVIDERS, ChannelProvider, CommsChannel } from './channel-provider.interface';

@Injectable()
export class ChannelProviderRegistry {
  private readonly byChannel: Map<CommsChannel, ChannelProvider>;

  constructor(@Inject(CHANNEL_PROVIDERS) providers: ChannelProvider[]) {
    this.byChannel = new Map(providers.map((provider) => [provider.channel, provider]));
  }

  list(): ChannelProvider[] {
    return Array.from(this.byChannel.values());
  }

  get(channel: CommsChannel): ChannelProvider {
    const provider = this.byChannel.get(channel);
    if (!provider) {
      throw new NotFoundException(`Channel provider "${channel}" is not registered`);
    }
    return provider;
  }

  has(channel: CommsChannel): boolean {
    return this.byChannel.has(channel);
  }
}

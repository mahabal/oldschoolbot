import { Command, Inhibitor, InhibitorStore, KlasaMessage } from 'klasa';

export default class extends Inhibitor {
	public constructor(store: InhibitorStore, file: string[], directory: string) {
		super(store, file, directory);
	}

	public async run(msg: KlasaMessage, command: Command) {
		if (!command.oneAtTime) return;

		if (this.client.oneCommandAtATimeCache.has(msg.author.id)) {
			throw true;
		}
	}
}

import {
	getIdealMaximumFrameCacheSizeInBytes,
	startLongRunningCompositor,
} from './compositor/compositor';
import type {
	GetSilentPartsResponse,
	GetSilentPartsResponseRust,
	SilentParts,
} from './compositor/payloads';
import type {LogLevel} from './log-level';

export const getSilentParts = async ({
	src,
	noiseThresholdInDecibels: passedNoiseThresholdInDecibels,
	minDurationInSeconds: passedMinDuration,
	logLevel,
}: {
	src: string;
	minDurationInSeconds?: number;
	logLevel?: LogLevel;
	noiseThresholdInDecibels?: number;
}): Promise<GetSilentPartsResponse> => {
	const compositor = startLongRunningCompositor(
		getIdealMaximumFrameCacheSizeInBytes(),
		logLevel ?? 'info',
		false,
	);

	const minDurationInSeconds = passedMinDuration ?? 1;

	if (typeof minDurationInSeconds !== 'number') {
		throw new Error(
			`minDurationInSeconds must be a number, but was ${minDurationInSeconds}`,
		);
	}

	if (minDurationInSeconds <= 0) {
		throw new Error(
			`minDurationInSeconds must be greater than 0, but was ${minDurationInSeconds}`,
		);
	}

	const noiseThresholdInDecibels = passedNoiseThresholdInDecibels ?? -20;

	if (typeof noiseThresholdInDecibels !== 'number') {
		throw new Error(
			`noiseThresholdInDecibels must be a number, but was ${noiseThresholdInDecibels}`,
		);
	}

	if (noiseThresholdInDecibels >= 30) {
		throw new Error(
			`noiseThresholdInDecibels must be less than 30, but was ${noiseThresholdInDecibels}`,
		);
	}

	const res = await compositor.executeCommand('GetSilences', {
		src,
		minDurationInSeconds,
		noiseThresholdInDecibels,
	});

	const response = JSON.parse(
		res.toString('utf-8'),
	) as GetSilentPartsResponseRust;

	compositor.finishCommands();
	await compositor.waitForDone();

	const {silentParts, durationInSeconds} = response;

	return {
		silentParts,
		audibleParts: getAudibleParts({silentParts, durationInSeconds}),
		durationInSeconds,
	};
};

const getAudibleParts = ({
	silentParts,
	durationInSeconds,
}: {
	silentParts: SilentParts;
	durationInSeconds: number;
}) => {
	const audibleParts: SilentParts = [];
	let lastEnd = 0;
	for (const silentPart of silentParts) {
		if (silentPart.startInSeconds - lastEnd > 0) {
			audibleParts.push({
				startInSeconds: lastEnd,
				endInSeconds: silentPart.startInSeconds,
			});
		}

		lastEnd = silentPart.endInSeconds;
	}

	if (durationInSeconds - lastEnd > 0) {
		audibleParts.push({
			startInSeconds: lastEnd,
			endInSeconds: durationInSeconds,
		});
	}

	return audibleParts;
};

import * as React from 'react'

export default class LiveSpeakInputIcon extends React.Component<{ abbreviation?: string }> {
	render(): JSX.Element {
		return (
			<svg className="piece-icon" version="1.1" viewBox="0 0 126.5 89" xmlns="http://www.w3.org/2000/svg">
				<linearGradient id="background-gradient" gradientTransform="rotate(90)">
					<stop className="stop1" offset={0.5} />
					<stop className="stop2" offset={0.5} />
				</linearGradient>
				<rect width="126.5" height="89" className="live-speak" />
				<text
					x="63.25"
					y="71.513954"
					textAnchor="middle"
					textLength="126.5"
					className="piece-icon-text"
					xmlSpace="preserve"
				>
					<tspan lengthAdjust="spacing" className="label">
						{this.props.abbreviation !== undefined ? this.props.abbreviation : 'LSK'}
					</tspan>
				</text>
			</svg>
		)
	}
}

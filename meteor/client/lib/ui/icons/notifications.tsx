import React, { JSX } from 'react'

export function CriticalIcon(): JSX.Element {
	return (
		<svg
			width="32"
			height="32"
			viewBox="0 0 32 32"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="type-critical"
			role="presentation"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M21.4651 1.05486C21.9955 1.05498 22.5042 1.2658 22.8792 1.64095L30.5024 9.26747C30.8774 9.64262 31.088 10.1514 31.0879 10.6818L31.0856 21.465C31.0855 21.9955 30.8747 22.5041 30.4995 22.8791L22.873 30.5024C22.4978 30.8774 21.9891 31.088 21.4587 31.0879L10.6754 31.0856C10.145 31.0855 9.63634 30.8746 9.26135 30.4995L1.63808 22.873C1.26309 22.4978 1.05249 21.9891 1.0526 21.4586L1.0549 10.6754C1.05502 10.145 1.26584 9.6363 1.64099 9.26131L9.26751 1.63804C9.64267 1.26305 10.1514 1.05245 10.6819 1.05256L21.4651 1.05486Z"
				fill="#FF0000"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M21.6798 2.29692L29.7055 10.3261L29.7031 21.6786L21.674 29.7043L10.3215 29.7018L2.29576 21.6727L2.29818 10.3202L10.3273 2.2945L21.6798 2.29692ZM10.9483 3.79463L3.79805 10.9418L3.79589 21.0517L10.9431 28.202L21.053 28.2041L28.2032 21.0569L28.2054 10.9471L21.0582 3.79679L10.9483 3.79463Z"
				fill="white"
			/>
			<path
				d="M24.178 16.3526C24.6128 15.8165 24.52 15.0156 23.964 14.5606C23.4874 14.1764 22.8374 14.1806 22.3843 14.5265L19.7914 17.0734L19.7457 8.7627C19.742 8.06264 19.1669 7.50748 18.4767 7.52131C17.7767 7.52505 17.2216 8.09011 17.2253 8.79017L17.2885 15.151L17.2092 7.23997C17.2054 6.5499 16.6303 5.99474 15.9403 5.99857C15.2402 6.00231 14.685 6.57737 14.6989 7.26752L14.7849 15.5386L14.7203 9.3378C14.7066 8.63765 14.1415 8.08257 13.4415 8.08632C12.7513 8.10015 12.1963 8.66521 12.2 9.36527L12.2615 15.9061L12.2332 12.3657C12.2286 11.7556 11.7329 11.2712 11.1229 11.2757C10.5128 11.2803 10.0284 11.7759 10.0329 12.386L10.0844 16.6966C10.185 19.9777 10.0345 17.8062 10.2417 20.3482C10.4605 22.7203 11.9676 24.1738 14.3968 24.2755L16.7267 24.2963C18.9366 24.3161 20.1101 22.8165 20.7701 21.6924L24.178 16.3526Z"
				fill="white"
				stroke="#FF0000"
				strokeWidth="0.5"
				strokeMiterlimit="10"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export function WarningIcon(): JSX.Element {
	return (
		<svg
			width="43"
			height="43"
			viewBox="6 0 32 32"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="type-warning"
			role="presentation"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M8.5144 29.0551C6.99401 29.0551 6.02961 27.4257 6.76108 26.0928L19.5495 2.79022C20.3089 1.40651 22.2967 1.40651 23.0561 2.79022L35.8445 26.0928C36.576 27.4257 35.6116 29.0551 34.0912 29.0551L8.5144 29.0551Z"
				fill="#FFFF00"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M10.7336 25.6312L31.873 25.6304L21.304 6.37098L10.7336 25.6312ZM8.16736 26.1501C7.8016 26.8165 8.28383 27.6313 9.04405 27.6312L33.5624 27.6303C34.3226 27.6303 34.8048 26.8156 34.4391 26.1492L22.1807 3.81136C21.801 3.11949 20.8071 3.11947 20.4274 3.81132L8.16736 26.1501Z"
				fill="black"
			/>
		</svg>
	)
}

export function InformationIcon(): JSX.Element {
	return (
		<svg
			width="27"
			height="27"
			viewBox="0 0 27 27"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="type-notification"
			role="presentation"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M18.4325 20.8653L18.2378 20.8746C18.1317 21.0937 17.9904 21.3549 17.8057 21.6431C17.2937 22.4423 16.4495 23.4478 15.1077 24.3343L15.0707 24.3588L15.0316 24.3799C13.0798 25.4339 11.6545 25.8729 10.6949 26.015C10.224 26.0847 9.82532 26.0888 9.51681 26.0334C9.40569 26.0135 9.13809 25.9598 8.90543 25.7732C8.79902 25.6878 8.46534 25.3799 8.51852 24.8608C8.57121 24.3463 8.95487 24.1123 9.07249 24.0506C10.0176 23.5552 10.6404 22.5661 11.0316 21.5628C11.121 21.3334 11.195 21.1115 11.256 20.9063H9C4.02944 20.9063 0 16.8768 0 11.9063V9.00001C0 4.02944 4.02944 0 9 0H18C22.9706 0 27 4.02944 27 9V11.8757C27 16.6781 23.2294 20.6345 18.4325 20.8653Z"
				fill="#3EDCFF"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M16.4153 18.4594L18.3124 18.3682C21.7768 18.2015 24.5 15.3441 24.5 11.8757V9C24.5 5.41015 21.5899 2.5 18 2.5H9C5.41015 2.5 2.5 5.41015 2.5 9.00001V11.9063C2.5 15.4961 5.41015 18.4063 9 18.4063H14.1901L13.9894 20.0844L12.5 19.9063H9C4.58172 19.9063 1 16.3245 1 11.9063V9.00001C1 4.58173 4.58172 1 9 1H18C22.4183 1 26 4.58172 26 9V11.8757C26 16.1445 22.6484 19.6613 18.3845 19.8664L17.5564 19.9063C17.5564 19.9063 16.9758 21.9014 14.5564 23.5C13.6359 23.9971 12.8513 24.3442 12.1947 24.5832C11.7408 24.7485 11.348 24.862 11.0137 24.9378C10.2094 25.1199 9.74384 25.083 9.58033 25.0194C9.50841 24.9914 9.49493 24.9582 9.53678 24.9363C9.98289 24.7024 10.3639 24.3937 10.6889 24.0439C10.9003 23.8165 11.088 23.5717 11.2545 23.3188C11.6732 22.6828 11.9578 21.9959 12.1479 21.4063C12.4224 20.5549 12.5 19.9063 12.5 19.9063C13.9894 20.0844 13.9894 20.0839 13.9894 20.0844L13.9889 20.0887L13.9882 20.0945L13.9862 20.11L13.9798 20.157C13.9744 20.1952 13.9667 20.247 13.9563 20.3109C13.9354 20.4384 13.9032 20.6151 13.8564 20.8284C13.7655 21.242 13.6162 21.8065 13.3789 22.424C13.5099 22.3574 13.6447 22.287 13.7834 22.2126C14.7628 21.5538 15.356 20.8324 15.7007 20.2945C15.8769 20.0195 15.9884 19.7917 16.0524 19.6446C16.0844 19.5712 16.1042 19.5184 16.1142 19.4905C16.1171 19.4824 16.1191 19.4765 16.1204 19.4727L16.4153 18.4594Z"
				fill="white"
			/>
		</svg>
	)
}

export function CriticalIconSmall(): JSX.Element {
	return (
		<svg
			width="21"
			height="21"
			viewBox="0 0 21 21"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="type-critical"
			role="presentation"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M14.4286 1.03697L19.9693 6.58651L19.9631 14.4285L14.4135 19.9693L6.57154 19.963L1.0308 14.4135L1.03704 6.57147L6.58658 1.03074L14.4286 1.03697Z"
				fill="#FF0000"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M14.1123 1.79887L19.2069 6.9016L19.2012 14.1122L14.0985 19.2068L6.88784 19.2011L1.79321 14.0984L1.79894 6.88777L6.90167 1.79314L14.1123 1.79887ZM7.31509 2.79347L2.79862 7.30277L2.79354 13.685L7.30285 18.2014L13.685 18.2065L18.2015 13.6972L18.2066 7.31502L13.6973 2.79854L7.31509 2.79347Z"
				fill="white"
			/>
			<path
				d="M16.6791 10.7985C17.0219 10.4278 16.9483 9.873 16.5094 9.55716C16.1331 9.2904 15.6202 9.29244 15.2628 9.53144L13.7039 10.6832L13.7536 5.4548C13.7504 4.96997 13.2963 4.58473 12.7517 4.59339C12.1993 4.59506 11.7616 4.98566 11.7649 5.47049L11.8176 9.87575L11.7514 4.39687C11.7481 3.91897 11.294 3.53373 10.7495 3.53547C10.1971 3.53714 9.75927 3.93466 9.7705 4.41264L9.84222 10.1409L9.78841 5.84644C9.77725 5.36153 9.3311 4.97637 8.77868 4.97803C8.23409 4.9867 7.79634 5.3773 7.79962 5.86213L7.85118 10.392L7.82718 7.94011C7.82331 7.5176 7.43194 7.18144 6.95054 7.18378C6.46914 7.18613 6.08709 7.52877 6.09096 7.95128L6.13355 10.9367C6.21451 13.2091 6.09467 11.7051 6.25941 13.4658C6.43316 15.1088 7.62306 16.1174 9.53998 16.1911L11.3785 16.2086C13.1224 16.2252 14.0477 15.1882 14.568 14.4106L16.6791 10.7985Z"
				fill="white"
				stroke="#FF0000"
				strokeWidth="0.5"
				strokeMiterlimit="10"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export function WarningIconSmall(): JSX.Element {
	return (
		<svg
			width="28"
			height="28"
			viewBox="4 0 21 21"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="type-warning"
			role="presentation"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M6.49068 19.2209C4.97029 19.2209 4.00589 17.5916 4.73736 16.2587L12.2467 2.57538C13.0061 1.19167 14.994 1.19168 15.7534 2.57539L23.2627 16.2587C23.9942 17.5916 23.0298 19.2209 21.5094 19.2209L6.49068 19.2209Z"
				fill="#FFFF00"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M7.14059 16.7619L20.8603 16.7614L14.0009 4.26186L7.14059 16.7619ZM5.41916 16.7808C5.0534 17.4473 5.53563 18.262 6.29585 18.262L21.7051 18.2614C22.4652 18.2614 22.9474 17.4467 22.5817 16.7803L14.8776 2.7415C14.4979 2.04964 13.504 2.04962 13.1243 2.74147L5.41916 16.7808Z"
				fill="black"
			/>
		</svg>
	)
}

// const WARNING_WORKING_ON_IT_CONFIG = {
// 	loop: true,
// 	autoplay: true,
// 	animationData: WarningIconSmallWorkingOnItAnimation,
// 	rendererSettings: {
// 		preserveAspectRatio: 'xMidYMid meet',
// 	},
// }

// export function WarningIconSmallWorkingOnIt(): JSX.Element {
// 	return <Lottie config={WARNING_WORKING_ON_IT_CONFIG} width="20" height="20" playingState="playing" />
// }

export function WarningIconSmallWorkingOnIt(): JSX.Element {
	return <img src="/images/warning-transferring.webp" width="20" height="20" alt="Warning" />
}

export function InformationIconSmall(): JSX.Element {
	return (
		<svg
			width="19"
			height="18"
			viewBox="0 0 19 18"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="type-notification"
			role="presentation"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M10.4859 16.8353L10.525 16.8142L10.562 16.7898C11.4604 16.1962 12.1485 15.5159 12.6107 14.9881C12.7766 14.7987 12.915 14.627 13.0253 14.4833C16.1481 14.2493 18.6172 11.6407 18.6172 8.44914V7.2424C18.6172 3.24253 15.3746 0 11.3748 0H7.28337C3.26087 0 0 3.26087 0 7.28336C0 11.1065 2.94569 14.2417 6.69126 14.543C6.70543 14.6607 6.71468 14.7859 6.71519 14.9132C6.71749 15.4856 6.55926 15.8413 6.20999 16.0244C6.09727 16.0835 5.71624 16.3146 5.66388 16.8258C5.61105 17.3416 5.94275 17.6461 6.04483 17.7279C6.26886 17.9076 6.51841 17.9544 6.60174 17.9694C6.85466 18.0148 7.15876 18.0083 7.49319 17.9588C8.17981 17.8572 9.1647 17.5488 10.4859 16.8353Z"
				fill="#3EDCFF"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M11.6679 12.1086L12.421 12.0688C14.4931 11.9595 16.1172 10.2474 16.1172 8.17242V7.5C16.1172 4.73858 13.8786 2.5 11.1172 2.5H7.28337C4.64159 2.5 2.5 4.64158 2.5 7.28336C2.5 9.92515 4.64159 12.0667 7.28337 12.0667H8.71853L8.96818 13.2594L7.5 13.5667H7.28337C3.81316 13.5667 1 10.7536 1 7.28336C1 3.81316 3.81316 1 7.28337 1H11.1172C14.707 1 17.6172 3.91015 17.6172 7.5V8.17242C17.6172 11.0451 15.3687 13.4153 12.5 13.5667C12.5 13.5667 11.6189 14.8929 10.0108 15.9554C9.53611 16.2118 9.11629 16.4089 8.74857 16.5593C8.53234 16.6477 8.33412 16.72 8.15336 16.7788C7.34146 17.0425 6.88175 17.0322 6.72378 16.9789C6.66171 16.9579 6.64623 16.9303 6.67428 16.9101C7.09838 16.6047 7.33564 16.1525 7.4622 15.6788C7.48661 15.5874 7.50689 15.4953 7.52361 15.4032C7.69122 14.4803 7.5 13.5667 7.5 13.5667C8.96818 13.2594 8.96809 13.259 8.96818 13.2594L8.96857 13.2613L8.96901 13.2634L8.97001 13.2683L8.97252 13.2807L8.97938 13.3162C8.98469 13.3444 8.9914 13.3817 8.99889 13.4271C9.01383 13.5176 9.03209 13.6418 9.04849 13.7916C9.07565 14.0395 9.09926 14.3714 9.09062 14.7455C9.13891 14.7204 9.18806 14.6945 9.23806 14.6678C9.88601 14.2316 10.3963 13.7418 10.7475 13.3547C10.9265 13.1575 11.0601 12.9913 11.1455 12.8796C11.1881 12.8238 11.2184 12.782 11.2361 12.7571C11.245 12.7447 11.2506 12.7365 11.2531 12.7329C11.2532 12.7327 11.2529 12.7331 11.2531 12.7329L11.6679 12.1086Z"
				fill="white"
			/>
		</svg>
	)
}

export function OKIconSmall(): JSX.Element {
	return (
		<svg
			width="21"
			height="21"
			viewBox="0 0 21 21"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="presentation"
			className="ok"
		>
			<path d="M15.882 5L8.376 13.427L5.414 10.631L4 12.046L8.452 16.332L17.368 6.338V6.337L15.882 5Z" fill="#04B800" />
		</svg>
	)
}

export function CollapseChevrons(): JSX.Element {
	return (
		<svg width="37" height="29" viewBox="0 0 37 29" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
			<path d="M8.15298 21.1207C7.89734 21.4009 7.75562 21.7666 7.75562 22.1459C7.75562 22.5252 7.89734 22.8908 8.15298 23.171C8.27469 23.3039 8.4225 23.4102 8.58717 23.4833C8.75184 23.5564 8.92982 23.5947 9.10998 23.5959C9.45798 23.5959 9.80598 23.4538 10.0699 23.171L16.8486 15.921C17.1043 15.6408 17.246 15.2752 17.246 14.8959C17.246 14.5166 17.1043 14.1509 16.8486 13.8707L10.0699 6.62072C9.94864 6.48691 9.80072 6.37998 9.63564 6.30679C9.47057 6.23361 9.292 6.1958 9.11143 6.1958C8.93087 6.1958 8.7523 6.23361 8.58722 6.30679C8.42215 6.37998 8.27423 6.48691 8.15298 6.62072C7.89734 6.90094 7.75562 7.26656 7.75562 7.64587C7.75562 8.02518 7.89734 8.3908 8.15298 8.67102L13.8834 14.8959L8.15298 21.1207Z" />
			<path d="M16.153 21.1207C15.8973 21.4009 15.7556 21.7666 15.7556 22.1459C15.7556 22.5252 15.8973 22.8908 16.153 23.171C16.2747 23.3039 16.4225 23.4102 16.5872 23.4833C16.7518 23.5564 16.9298 23.5947 17.11 23.5959C17.458 23.5959 17.806 23.4538 18.0699 23.171L24.8486 15.921C25.1043 15.6408 25.246 15.2752 25.246 14.8959C25.246 14.5166 25.1043 14.1509 24.8486 13.8707L18.0699 6.62072C17.9486 6.48691 17.8007 6.37998 17.6356 6.30679C17.4706 6.23361 17.292 6.1958 17.1114 6.1958C16.9309 6.1958 16.7523 6.23361 16.5872 6.30679C16.4222 6.37998 16.2742 6.48691 16.153 6.62072C15.8973 6.90094 15.7556 7.26656 15.7556 7.64587C15.7556 8.02518 15.8973 8.3908 16.153 8.67102L21.8834 14.8959L16.153 21.1207Z" />
		</svg>
	)
}

export function HourglassIconSmall(): JSX.Element {
	return (
		<svg
			width="16"
			height="14"
			viewBox="0 0 16 14"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="presentation"
			className="hourglass"
		>
			<g clipPath="url(#clip0_5400_19956)">
				<path
					d="M7 5.44444L9.75741 2.52055C10.2941 1.94036 9.88203 1 9.09107 1L1.90893 1C1.11797 1 0.705885 1.94036 1.24259 2.52055L9.75741 11.4795C10.2941 12.0596 9.88203 13 9.09107 13C6.28627 13 4.71373 13 1.90893 13C1.11797 13 0.705883 12.0596 1.24259 11.4795L3.88888 8.55556"
					stroke="white"
					strokeWidth="2"
				/>
			</g>
			<defs>
				<clipPath id="clip0_5400_19956">
					<rect width="16" height="14" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
}

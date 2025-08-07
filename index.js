async function main() {
	const funticoSDK = new FunticoSDK({
		authClientId: "mock_store_fe",
		env: "development",
	});

	let currentUser = null;

	const loginBtn = document.getElementById("loginBtn");
	const logoutBtn = document.getElementById("logoutBtn");
	const userInfoElement = document.getElementById("userInfo");

	async function handleAuthCallback() {
		const urlParams = new URLSearchParams(window.location.search);
		const code = urlParams.get("code");
		const state = urlParams.get("state");

		if (code && state) {
			const codeVerifier = sessionStorage.getItem(`pkce_${state}`);
			sessionStorage.removeItem(`pkce_${state}`);

			if (codeVerifier) {
				const tokens = await funticoSDK.getTokens({
					codeVerifier,
					url: window.location.href,
				});

				tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken, tokens.idToken);

				window.history.replaceState(
					{},
					document.title,
					window.location.pathname,
				);
			}
		}
	}

	async function login() {
		const { codeVerifier, redirectUrl, state } =
			await funticoSDK.signInWithFuntico({
				callbackUrl: window.location.href,
			});

		sessionStorage.setItem(`pkce_${state}`, codeVerifier);
		window.location.href = redirectUrl;
	}

	async function loadUserData() {
		try {
			const accessToken = tokenStorage.getAccessToken();

			if (!accessToken) {
				throw new Error("No access token available");
			}

			const userInfo = await funticoSDK.getUserInfo({ accessToken });
			const { balance } = await funticoSDK.getUserBalance({ accessToken });

			currentUser = {
				...userInfo,
				balance,
			};

			document.getElementById("balance").textContent =
				`TICO ${currentUser.balance}`;
			document.getElementById("username").textContent =
				currentUser.preferred_username;
			document.getElementById("email").textContent = currentUser.email;

			userInfoElement.classList.add("show");
			loginBtn.style.display = "none";
			logoutBtn.style.display = "inline-block";
		} catch (error) {
			if (isSDKError(error) && error.name === "auth_error") {
				await attemptTokenRefresh();
			} else {
				logout();
			}
		}
	}

	async function attemptTokenRefresh() {
		const refreshToken = tokenStorage.getRefreshToken();

		if (!refreshToken) {
			logout();
			return;
		}

		try {
			const tokens = await funticoSDK.refreshTokens({ refreshToken });
			tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken, tokens.idToken);
			await loadUserData();
		} catch (error) {
			tokenStorage.clearTokens();
			logout();
		}
	}

	async function logout() {
		const idToken = tokenStorage.getIdToken();
		const { signOutUrl } = await funticoSDK.signOut({
			postSignOutRedirectUrl: window.location.origin,
			idTokenHint: idToken
		});

		cleanupSession();
		window.location.href = signOutUrl;
	}

	function cleanupSession() {
		tokenStorage.clearTokens();
		currentUser = null;

		userInfoElement.classList.remove("show");
		loginBtn.style.display = "inline-block";
		logoutBtn.style.display = "none";
	}

	loginBtn.addEventListener("click", login);
	logoutBtn.addEventListener("click", logout);

	await handleAuthCallback();

	if (tokenStorage.hasValidTokens()) {
		await loadUserData();
	}
}

main();

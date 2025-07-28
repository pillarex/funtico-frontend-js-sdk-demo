async function main() {
	const funticoSDK = new FunticoSDK({
		authClientId: "mock_store_fe",
		env: "staging",
	});

	let currentUser = null;
	let refreshInterval = null;
	let refreshTimeout = null;
	let isRefreshing = false;
	const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000;

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

				tokenStorage.setTokens(
					tokens.accessToken,
					tokens.refreshToken,
				);

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
				`Balance: TICO ${currentUser.balance}`;
			document.getElementById("username").textContent =
				currentUser.preferred_username;
			document.getElementById("email").textContent = currentUser.email;

			userInfoElement.classList.add("show");
			loginBtn.style.display = "none";
			logoutBtn.style.display = "inline-block";
			startTokenRefreshTimer();
		} catch (error) {
			if (error.status === 401) {
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
			tokenStorage.setTokens(
				tokens.accessToken,
				tokens.refreshToken,
			);
			await loadUserData();
		} catch (error) {
			tokenStorage.clearTokens();
			logout();
		}
	}

	function startTokenRefreshTimer() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}

		refreshInterval = setInterval(async () => {
			await refreshTokens();
		}, TOKEN_REFRESH_INTERVAL);

		scheduleTokenRefreshBeforeExpiry();
	}

	function scheduleTokenRefreshBeforeExpiry() {
		if (refreshTimeout) {
			clearTimeout(refreshTimeout);
		}

		const expiryTime = tokenStorage.getTokenExpiry();
		if (!expiryTime) return;

		const now = Date.now();
		const timeUntilExpiry = expiryTime - now;
		const refreshTime = timeUntilExpiry - 10 * 60 * 1000;

		if (refreshTime > 0) {
			refreshTimeout = setTimeout(async () => {
				await refreshTokens();
			}, refreshTime);
		}
	}

	async function refreshTokens() {
		if (isRefreshing) {
			return;
		}

		isRefreshing = true;

		try {
			const refreshToken = tokenStorage.getRefreshToken();
			if (!refreshToken) {
				throw new Error("No refresh token available");
			}

			const tokens = await funticoSDK.refreshTokens({ refreshToken });
			tokenStorage.setTokens(
				tokens.accessToken,
				tokens.refreshToken,
			);
			scheduleTokenRefreshBeforeExpiry();
		} catch (error) {
			logout();
		} finally {
			isRefreshing = false;
		}
	}

	async function logout() {
		await funticoSDK.signOut();

		cleanupSession();
	}

	function cleanupSession() {
		tokenStorage.clearTokens();
		currentUser = null;

		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}

		if (refreshTimeout) {
			clearTimeout(refreshTimeout);
			refreshTimeout = null;
		}

		userInfoElement.classList.remove("show");
		loginBtn.style.display = "inline-block";
		logoutBtn.style.display = "none";
	}

	loginBtn.addEventListener("click", login);
	logoutBtn.addEventListener("click", logout);

	window.addEventListener("beforeunload", () => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
		if (refreshTimeout) {
			clearTimeout(refreshTimeout);
		}
	});

	await handleAuthCallback();

	if (tokenStorage.hasValidTokens()) {
		await loadUserData();
	}
}

main();

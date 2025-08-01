async function main() {
	const funticoSDK = new FunticoSDK({
		authClientId: "mock_store_fe",
		env: "staging",
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
				try {
					// SDK now automatically stores tokens internally
					const tokens = await funticoSDK.getTokens({
						codeVerifier,
						url: window.location.href,
					});

					// No need to manually store tokens anymore
					// tokenStorage.setTokens is handled automatically by the SDK

					window.history.replaceState(
						{},
						document.title,
						window.location.pathname,
					);
				} catch (error) {
					alert(`Authentication failed: ${JSON.stringify(error)}`);
				}
			}
		}
	}

	async function login() {
		try {
			const { codeVerifier, redirectUrl, state } =
				await funticoSDK.signInWithFuntico({
					callbackUrl: window.location.href,
				});

			sessionStorage.setItem(`pkce_${state}`, codeVerifier);
			window.location.href = redirectUrl;
		} catch (error) {
			alert(`Login failed: ${JSON.stringify(error)}`);
		}
	}

	async function loadUserData() {
		try {
			// SDK now automatically uses stored access token
			const userInfo = await funticoSDK.getUserInfo();

			currentUser = userInfo;

			const userPictureElement = document.getElementById("userPicture");
			if (currentUser.picture) {
				userPictureElement.src = currentUser.picture;
				userPictureElement.style.display = "block";
			} else {
				userPictureElement.style.display = "none";
			}
			document.getElementById("username").textContent = currentUser.username;
			document.getElementById("userId").textContent = currentUser.user_id;

			userInfoElement.classList.add("show");
			loginBtn.style.display = "none";
			logoutBtn.style.display = "inline-block";

			document
				.getElementById("saveScoreBtn")
				.addEventListener("click", saveScore);
		} catch (error) {
			alert(`Failed to load user data: ${JSON.stringify(error)}`);
			if (isSDKError(error) && error.name === "auth_error") {
				await attemptTokenRefresh();
			} else {
				logout();
			}
		}
	}

	async function attemptTokenRefresh() {
		// Check if refresh token exists before attempting refresh
		const refreshToken = tokenStorage.getRefreshToken();

		if (!refreshToken) {
			logout();
			return;
		}

		try {
			// SDK now automatically uses stored refresh token and stores new tokens
			const tokens = await funticoSDK.refreshTokens();
			
			// No need to manually store tokens anymore
			// tokenStorage.setTokens is handled automatically by the SDK
			
			await loadUserData();
		} catch (error) {
			// SDK automatically clears tokens on refresh failure
			logout();
		}
	}

	async function logout() {
		try {
			// SDK now automatically uses stored ID token and clears tokens
			const { signOutUrl } = await funticoSDK.signOut({
				postSignOutRedirectUrl: window.location.origin,
			});

			// No need to manually clear tokens anymore
			// tokenStorage.clearTokens() is handled automatically by the SDK
			
			cleanupSession();
			window.location.href = signOutUrl;
		} catch (error) {
			alert(`Logout failed: ${JSON.stringify(error)}`);
			cleanupSession();
		}
	}

	function cleanupSession() {
		// Manual token clearing as a fallback (SDK should handle this automatically)
		tokenStorage.clearTokens();
		currentUser = null;

		userInfoElement.classList.remove("show");
		loginBtn.style.display = "inline-block";
		logoutBtn.style.display = "none";
	}

	async function saveScore() {
		const scoreInput = document.getElementById("scoreInput");
		const score = parseInt(scoreInput.value, 10);

		if (isNaN(score) || score !== parseFloat(scoreInput.value)) {
			alert("Please enter a valid integer score");
			return;
		}

		try {
			// SDK automatically handles authentication for score saving
			await funticoSDK.saveScore(score);
			alert("Score saved successfully!");
			scoreInput.value = "";
		} catch (error) {
			alert(`Failed to save score: ${JSON.stringify(error)}`);
		}
	}

	loginBtn.addEventListener("click", login);
	logoutBtn.addEventListener("click", logout);

	try {
		await handleAuthCallback();
	} catch (error) {
		alert(`Auth callback failed: ${JSON.stringify(error)}`);
	}

	if (tokenStorage.hasValidTokens()) {
		try {
			await loadUserData();
			document
				.getElementById("saveScoreBtn")
				.addEventListener("click", saveScore);
		} catch (error) {
			alert(`Failed to load user data: ${JSON.stringify(error)}`);
		}
	}
}

main();

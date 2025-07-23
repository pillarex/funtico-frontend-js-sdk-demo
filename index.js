async function main() {
	const funticoSDK = new FunticoSDK({
		authClientId: "ZozwXMVOkIhFIeC3J91rpF4bvxuNFYnCEv29aG2GbjT",
		env: "staging",
	});

	let currentUser = null;
	let refreshInterval = null;

	let gameRunning = false;
	let score = 0;
	const player = { x: 50, y: 50, size: 20, speed: 5 };
	let collectibles = [];
	let animationFrame;

	const loginBtn = document.getElementById("loginBtn");
	const logoutBtn = document.getElementById("logoutBtn");
	const userInfo = document.getElementById("userInfo");
	const canvas = document.getElementById("gameCanvas");

	const ctx = canvas.getContext("2d");
	const gameInstructions = document.getElementById("gameInstructions");
	const scoreElement = document.getElementById("score");

	await handleAuthCallback();

	if (tokenStorage.hasValidTokens()) {
		await loadUserData();
	}

	async function handleAuthCallback() {
		const urlParams = new URLSearchParams(window.location.search);
		const code = urlParams.get("code");
		const state = urlParams.get("state");

		console.log("Auth callback detected:", { code: !!code, state: !!state });

		if (code && state) {
			const codeVerifier = sessionStorage.getItem(`pkce_${state}`);
			sessionStorage.removeItem(`pkce_${state}`);

			console.log("Code verifier found:", !!codeVerifier);

			if (codeVerifier) {
				try {
					const tokens = await funticoSDK.getTokens({
						codeVerifier,
						url: window.location.href,
					});

					console.log("Tokens received:", {
						accessToken: !!tokens.accessToken,
						refreshToken: !!tokens.refreshToken,
					});

					tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);

					window.history.replaceState(
						{},
						document.title,
						window.location.pathname,
					);

					console.log("Auth callback completed successfully");
				} catch (error) {
					console.error("Error exchanging code for tokens:", error);
				}
			} else {
				console.warn("No code verifier found for state:", state);
			}
		}
	}

	async function login() {
		const { codeVerifier, redirectUrl, state } =
			await funticoSDK.signInWithFuntico({
				callbackUrl: new URL(window.location.origin).toString(),
			});

		sessionStorage.setItem(`pkce_${state}`, codeVerifier);

		window.location.href = redirectUrl;
	}

	async function loadUserData() {
		try {
			const accessToken = tokenStorage.getAccessToken();

			if (accessToken) {
				const userInfo = await funticoSDK.getUserInfo({ accessToken });
				const { balance } = await funticoSDK.getUserBalance({ accessToken });

				currentUser = {
					...userInfo,
					balance: balance,
				};

				updateUserInterface();
				enableGame();
				startTokenRefreshTimer();
			}
		} catch (error) {
			const refreshToken = tokenStorage.getRefreshToken();
			if (refreshToken) {
				try {
					const tokens = await funticoSDK.refreshTokens({ refreshToken });
					tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
					await loadUserData();
				} catch (refreshError) {
					tokenStorage.clearTokens();
					logout();
				}
			}
		}
	}

	function updateUserInterface() {
		if (!currentUser) return;

		document.getElementById("balance").textContent =
			`Balance: $${currentUser.balance}`;
		document.getElementById("username").textContent =
			currentUser.name || "Name not available";
		document.getElementById("email").textContent =
			currentUser.email || "Email not available";

		userInfo.classList.add("show");
		loginBtn.style.display = "none";
		logoutBtn.style.display = "inline-block";
	}

	// Start token refresh timer - simplified version
	function startTokenRefreshTimer() {
		if (refreshInterval) clearInterval(refreshInterval);

		refreshInterval = setInterval(async () => {
			// Check if tokens are still valid
			if (!tokenStorage.hasValidTokens()) {
				logout();
			}
		}, 60000); // Check every minute
	}

	async function refreshToken() {
		try {
			const refreshToken = tokenStorage.getRefreshToken();
			if (refreshToken) {
				const tokens = await funticoSDK.refreshTokens({ refreshToken });
				tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
			}
		} catch (error) {
			console.error("Failed to refresh token:", error.message);
			logout();
		}
	}

	// Logout function
	async function logout() {
		try {
			const { signOutUrl } = await funticoSDK.signOut({
				postSignOutRedirectUri: window.location.origin,
			});

			tokenStorage.clearTokens();
			currentUser = null;

			if (refreshInterval) {
				clearInterval(refreshInterval);
				refreshInterval = null;
			}

			userInfo.classList.remove("show");
			loginBtn.style.display = "inline-block";
			logoutBtn.style.display = "none";

			disableGame();

			// Redirect to sign out URL
			window.location.href = signOutUrl;
		} catch (error) {
			console.error("Logout error:", error.message);
			// Fallback - just clear local tokens
			tokenStorage.clearTokens();
			currentUser = null;
			userInfo.classList.remove("show");
			loginBtn.style.display = "inline-block";
			logoutBtn.style.display = "none";
			disableGame();
		}

	// Game functions
	function enableGame() {
		canvas.classList.add("show");
		gameInstructions.textContent =
			"Game ready! Use WASD or Arrow Keys to move and collect red dots!";
		document.getElementById("gameControls").style.display = "block";
		startGame();
	}

	function disableGame() {
		canvas.classList.remove("show");
		gameInstructions.textContent = "Please login to start playing!";
		document.getElementById("gameControls").style.display = "none";
		stopGame();
	}

	function startGame() {
		if (gameRunning) return;

		gameRunning = true;
		score = 0;
		scoreElement.textContent = score;

		// Reset player position
		player.x = 50;
		player.y = 50;

		// Generate initial collectibles
		generateCollectibles();

		// Start game loop
		gameLoop();
	}

	function stopGame() {
		gameRunning = false;
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		collectibles = [];
	}

	function generateCollectibles() {
		collectibles = [];
		for (let i = 0; i < 5; i++) {
			collectibles.push({
				x: Math.random() * (canvas.width - 20),
				y: Math.random() * (canvas.height - 20),
				size: 10,
			});
		}
	}

	function gameLoop() {
		if (!gameRunning) return;

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Draw player
		ctx.fillStyle = "#4CAF50";
		ctx.fillRect(player.x, player.y, player.size, player.size);

		// Draw collectibles
		ctx.fillStyle = "#f44336";
		collectibles.forEach((collectible) => {
			ctx.fillRect(
				collectible.x,
				collectible.y,
				collectible.size,
				collectible.size,
			);
		});

		// Check collisions
		checkCollisions();

		animationFrame = requestAnimationFrame(gameLoop);
	}

	function checkCollisions() {
		for (let i = collectibles.length - 1; i >= 0; i--) {
			const collectible = collectibles[i];

			if (
				player.x < collectible.x + collectible.size &&
				player.x + player.size > collectible.x &&
				player.y < collectible.y + collectible.size &&
				player.y + player.size > collectible.y
			) {
				// Collision detected
				collectibles.splice(i, 1);
				score += 10;
				scoreElement.textContent = score;

				// Generate new collectible
				collectibles.push({
					x: Math.random() * (canvas.width - 20),
					y: Math.random() * (canvas.height - 20),
					size: 10,
				});
			}
		}
	}

	// Keyboard controls
	const keys = {};

	document.addEventListener("keydown", (e) => {
		keys[e.key] = true;

		if (gameRunning) {
			if (keys["w"] || keys["W"] || keys["ArrowUp"]) {
				player.y = Math.max(0, player.y - player.speed);
			}
			if (keys["s"] || keys["S"] || keys["ArrowDown"]) {
				player.y = Math.min(
					canvas.height - player.size,
					player.y + player.speed,
				);
			}
			if (keys["a"] || keys["A"] || keys["ArrowLeft"]) {
				player.x = Math.max(0, player.x - player.speed);
			}
			if (keys["d"] || keys["D"] || keys["ArrowRight"]) {
				player.x = Math.min(
					canvas.width - player.size,
					player.x + player.speed,
				);
			}
		}
	});

	document.addEventListener("keyup", (e) => {
		keys[e.key] = false;
	});

	// Event listeners
	loginBtn.addEventListener("click", login);
	logoutBtn.addEventListener("click", logout);

	// Cleanup on page unload
	window.addEventListener("beforeunload", () => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});
}

main();

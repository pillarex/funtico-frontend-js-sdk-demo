async function main() {
	const funticoSDK = new FunticoSDK({
		authClientId: "mock_store_fe",
		env: "staging",
	});

	let currentUser = null;

	const loginBtn = document.getElementById("loginBtn");
	const logoutBtn = document.getElementById("logoutBtn");
	const userInfoElement = document.getElementById("userInfo");

	function cleanupSession() {
		currentUser = null;
		userInfoElement.classList.remove("show");
		loginBtn.style.display = "inline-block";
		logoutBtn.style.display = "none";
	}

	async function loadUserData() {
		try {
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
		} catch {
			cleanupSession();
		}
	}

	async function saveScore() {
		const scoreInput = document.getElementById("scoreInput");
		const score = Number(scoreInput.value);

		await funticoSDK.saveScore(score);
		alert("Score saved successfully!");
		scoreInput.value = "";
	}

	loginBtn.addEventListener("click", () =>
		funticoSDK.signInWithFuntico(window.location.href),
	);
	logoutBtn.addEventListener("click", () =>
		funticoSDK.signOut(window.location.origin).catch(cleanupSession),
	);

	await loadUserData();
}

main();

# Detect OS type
UNAME_S := $(shell uname -s)

ifeq ($(UNAME_S),Linux)
    SED = sed -i
	IP_NGINX=$$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nginx)
else ifeq ($(UNAME_S),Darwin)
    SED = sed -i ""
    IP_NGINX=127.0.0.1
else
    $(error Unsupported OS: $(UNAME_S))
endif

install:
	$(SED) 's/staging/development/'  										       ./index.js
	$(SED) 's/https:\/\/funtico-frontend-js-sdk.pages.dev/\/\/sdk.funtico.local/'  ./index.html
FROM langchain/langgraphjs-api:20
ADD . /deps/lacalle_agent
ENV LANGSERVE_GRAPHS='{"zentrum": "./src/zentrum.ts:workflow"}'
WORKDIR /deps/lacalle_agent
RUN npm ci
RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts
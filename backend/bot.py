#
# Voice pipeline — Prosper Product Engineer Challenge
#
# The runnable voice agent: WebRTC transport + ElevenLabs STT/TTS + OpenAI LLM,
# driven by a Pipecat Flows node graph. This file is generic — it loads an agent
# definition (JSON) via AgentBuilder and runs it. Swapping the agent is a data
# change (edit/replace the JSON), not a code change.
#
#   example_flow.json  ->  AgentBuilder  ->  Pipecat Flows graph  ->  FlowManager
#
# Run:  python bot.py   then open http://localhost:7860/client
#

import os
from pathlib import Path

from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.elevenlabs.stt import ElevenLabsRealtimeSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.workers.runner import WorkerRunner
from pipecat_flows import FlowManager

from agent_builder import AgentBuilder
from control_api import active_flow_path, get_test_session_document, mark_runtime_completed, mark_runtime_connected, record_runtime_event, start_control_server

# Load .env next to this file, so the bot runs the same from the repo root or backend/.
load_dotenv(Path(__file__).parent / ".env", override=True)


# The agent this bot runs. Point this at any agent JSON (the Phase 2 Composer
# would generate one and drop it here).
AGENT_FLOW = Path(__file__).parent / "example_flow.json"


transport_params = {
    "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
}


def client_session_id(client) -> str | None:
    """Read the browser-provided control session ID without trusting arbitrary runtime data."""
    if isinstance(client, dict):
        value = client.get("session_id") or client.get("sessionId")
        return value if isinstance(value, str) and value else None
    for attribute in ("session_id", "sessionId"):
        value = getattr(client, attribute, None)
        if isinstance(value, str) and value:
            return value
    return None


async def run_bot(
    transport: BaseTransport, runner_args: RunnerArguments, builder: AgentBuilder
) -> None:
    config = builder.config
    logger.info(f"Starting '{config.name}' with {len(config.nodes)} nodes")

    stt = ElevenLabsRealtimeSTTService(api_key=os.environ["ELEVENLABS_API_KEY"])
    tts = ElevenLabsTTSService(
        api_key=os.environ["ELEVENLABS_API_KEY"],
        settings=ElevenLabsTTSService.Settings(voice=config.voice_id),
    )
    llm = OpenAILLMService(api_key=os.environ["OPENAI_API_KEY"], model=config.model)

    context = LLMContext()
    context_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            context_aggregator.user(),
            llm,
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),
        idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
    )

    flow_manager = FlowManager(
        llm=llm,
        context_aggregator=context_aggregator,
        worker=worker,
        transport=transport,
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        session_id = client_session_id(client)
        preview_document = get_test_session_document(session_id)
        active_builder = AgentBuilder.from_dict(preview_document) if preview_document else AgentBuilder.from_json(active_flow_path(AGENT_FLOW))
        logger.info(f"Client connected — starting '{active_builder.config.name}' at initial node")
        await flow_manager.initialize(active_builder.build_initial_node())
        mark_runtime_connected(active_builder.config.initial_node, session_id)
        initial = next((node for node in active_builder.config.nodes if node.name == active_builder.config.initial_node), None)
        if initial and initial.type == "tool":
            record_runtime_event("tool_call", f"Mock tool called: {initial.tool.get('name', initial.name) if initial.tool else initial.name}.", session_id=session_id, node_id=initial.id or initial.name, mock=True)
        if initial and initial.type == "transfer":
            record_runtime_event("handoff", f"Mock handoff: {initial.transfer.get('reason', 'Transfer requested.') if initial.transfer else 'Transfer requested.'}", session_id=session_id, node_id=initial.id or initial.name, mock=True)

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        mark_runtime_completed(client_session_id(client))
        await worker.cancel()

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)
    await runner.run()


async def bot(runner_args: RunnerArguments):
    """Entry point invoked by the Pipecat dev runner (and Pipecat Cloud)."""
    transport = await create_transport(runner_args, transport_params)
    builder = AgentBuilder.from_json(active_flow_path(AGENT_FLOW))
    await run_bot(transport, runner_args, builder)


if __name__ == "__main__":
    from pipecat.runner.run import main

    # The frontend needs the control API before the first voice client connects.
    start_control_server()
    main()

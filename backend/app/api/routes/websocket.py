from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
from app.core.config import settings

router = APIRouter()

@router.websocket("/shortlist/{task_id}")
async def shortlist_progress(websocket: WebSocket, task_id: str):
    await websocket.accept()
    redis_conn = aioredis.from_url(settings.redis_url)
    pubsub = redis_conn.pubsub()
    await pubsub.subscribe(f"shortlist:{task_id}")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                await websocket.send_text(data)
                
                import json
                parsed = json.loads(data)
                if parsed.get("status") in ["done", "failed"]:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"shortlist:{task_id}")
        await redis_conn.close()

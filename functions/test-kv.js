// 简单 KV 测试函数 - 按官方文档规范直接使用全局变量 TEXTDB
export async function onRequestGet({ request }) {
  try {
    // 直接使用全局变量 TEXTDB（官方示例方式）
    const testValue = await TEXTDB.get('test_key');
    
    let count = Number(testValue || '0');
    count += 1;
    
    await TEXTDB.put('test_key', String(count));
    
    return new Response(JSON.stringify({
      status: 'ok',
      test_key: 'test_key',
      count: count,
      message: 'KV test successful!'
    }), {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      status: 'error',
      error: e.message,
      stack: e.stack,
      TEXTDB_exists: typeof TEXTDB !== 'undefined'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
exports.handler = async (event) => {
  // 允许的访问码（可以在这里添加多个）
  const validCodes = ['4R', 'secret', '123456'];
  
  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body);
      const code = data.code;
      
      if (validCodes.includes(code)) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: '访问码正确',
            redirectUrl: '/private.html'
          })
        };
      } else {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: false,
            message: '访问码错误，请重试'
          })
        };
      }
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: '请求格式错误'
        })
      };
    }
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        message: '只支持 POST 请求'
      })
    };
  }
};

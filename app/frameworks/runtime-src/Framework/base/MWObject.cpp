#include "MWObject.h"

#include <sstream>

using namespace cocos2d;
using namespace std;

MW_FRAMEWORK_BEGIN

MWObject::MWObject()
#if MW_ENABLE_SCRIPT_BINDING
: _scriptType(kScriptTypeNone)
#endif
{
#if MW_ENABLE_SCRIPT_BINDING
    ScriptEngineProtocol *pEngine = ScriptEngineManager::getInstance()->getScriptEngine();
    if (pEngine) {
        _scriptType = pEngine->getScriptType();
    }
#endif
}

MWObject::~MWObject()
{
    
}

string MWObject::toString()
{
    stringstream ss;
    ss << typeid(this).name();
    ss << "\t0x";
#if CC_TARGET_PLATFORM == CC_PLATFORM_IOS
    MW_ULONG addr = (MW_ULONG) this;
#elif CC_TARGET_PLATFORM == CC_PLATFORM_ANDROID
    MW_UINT addr = (MW_UINT) this;
#else
    MW_ULONG addr = (MW_ULONG) this;
#endif
    ss << string(__String::createWithFormat("%x", addr)->getCString());
    return ss.str();
}

MW_FRAMEWORK_END
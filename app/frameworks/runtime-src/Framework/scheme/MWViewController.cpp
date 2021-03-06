#include "MWViewController.h"
#include "MWGameScene.h"
#include "MWGameView.h"
#include "MWViewSegue.h"
#if MW_ENABLE_SCRIPT_BINDING
#include "../js/MWJsUtils.h"
#endif
#include <new>

using namespace cocos2d;
using namespace std;

MW_FRAMEWORK_BEGIN

MWViewController *MWViewController::create(MWViewSegue *segue)
{
    auto pVc = new (nothrow) MWViewController();
    if (pVc && pVc->init(segue)) {
        pVc->autorelease();
        return pVc;
    }
    CC_SAFE_RELEASE(pVc);
    return nullptr;
}

bool MWViewController::init(MWViewSegue *segue)
{
    CC_SAFE_RELEASE(_segue);
    _segue = segue;
    CC_SAFE_RETAIN(_segue);
    
    return true;
}

MWViewController::MWViewController()
: _scene(nullptr)
, _view(nullptr)
, _segue(nullptr)
, _identifer()
{
}

MWViewController::~MWViewController()
{
    CC_SAFE_RELEASE(_view);
    CC_SAFE_RELEASE(_segue);
}

void MWViewController::viewDidLoad()
{
    if (!_view) {
        _view = MWGameView::create();
        _view->retain();
    }
    
#if MW_ENABLE_SCRIPT_BINDING
    if (_scriptType == kScriptTypeLua) {
        // lua todo
    } else if (_scriptType == kScriptTypeJavascript) {
        MWJsUtils::getInstance()->executeOwnerFunction(this, "viewDidLoad", 0, nullptr);
    }
#endif
}

void MWViewController::viewDidUnload()
{
#if MW_ENABLE_SCRIPT_BINDING
    if (_scriptType == kScriptTypeLua) {
        // lua todo
    } else if (_scriptType == kScriptTypeJavascript) {
        MWJsUtils::getInstance()->executeOwnerFunction(this, "viewDidUnload", 0, nullptr);
    }
#endif
    
    if (_view && _view->getParent()) {
        _view->removeFromParent();
    }
}

void MWViewController::didReceiveMemoryWarning()
{
#if MW_ENABLE_SCRIPT_BINDING
    if (_scriptType == kScriptTypeLua) {
        // lua todo
    } else if (_scriptType == kScriptTypeJavascript) {
        MWJsUtils::getInstance()->executeOwnerFunction(this, "didReceiveMemoryWarning", 0, nullptr);
    }
#endif
}

MW_FRAMEWORK_END

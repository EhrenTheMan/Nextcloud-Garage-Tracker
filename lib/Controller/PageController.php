<?php

declare(strict_types=1);

namespace OCA\AutoTracker\Controller;

use OCA\AutoTracker\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\Util;

class PageController extends Controller {
	public function __construct(IRequest $request) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): TemplateResponse {
		Util::addScript(Application::APP_ID, 'economy');
		Util::addScript(Application::APP_ID, 'auto-tracker');
		Util::addStyle(Application::APP_ID, 'auto-tracker');
		return new TemplateResponse(Application::APP_ID, 'main');
	}
}

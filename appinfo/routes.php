<?php

return [
	'routes' => [
		['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
		['name' => 'vehicle#index', 'url' => '/vehicles', 'verb' => 'GET'],
		['name' => 'vehicle#create', 'url' => '/vehicles', 'verb' => 'POST'],
		['name' => 'vehicle#update', 'url' => '/vehicles/{id}', 'verb' => 'PUT'],
		['name' => 'vehicle#destroy', 'url' => '/vehicles/{id}', 'verb' => 'DELETE'],
		['name' => 'vehicle#files', 'url' => '/files', 'verb' => 'GET'],
	],
];

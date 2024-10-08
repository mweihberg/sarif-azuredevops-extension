// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Viewer } from '@microsoft/sarif-web-component'
import { CommonServiceIds, getClient, IProjectPageService } from 'azure-devops-extension-api'
import { BuildRestClient, BuildServiceIds, IBuildPageDataService } from 'azure-devops-extension-api/Build'
import * as SDK from 'azure-devops-extension-sdk'
import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Log } from 'sarif'
import { getArtifactsFileEntries } from './build.getArtifactsFileEntries'

const perfLoadStart = performance.now() // For telemetry.

@observer class Tab extends React.Component {
	@observable.ref logs = undefined as Log[]
	@observable.ref toolNames = undefined as Set<string>
	@observable pipelineId = undefined as string
	@observable user = undefined as string
	@observable tenant = undefined as string
	constructor(props) {
		super(props)
		SDK.init({
			applyTheme: true,
			loaded: true,
		})
			; (async () => {
				await SDK.ready()

				const user = SDK.getUser()
				const organization = SDK.getHost().name
				const accessToken = await SDK.getAccessToken();
				const identitiesUri = `https://vssps.dev.azure.com/${organization}/_apis/identities?searchFilter=General&filterValue=${user.name}&queryMembership=None&api-version=7.0`

				const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService)
				const project = await projectService.getProject()

				const buildPageDataService = await SDK.getService<IBuildPageDataService>(BuildServiceIds.BuildPageDataService)
				const buildPageData = await buildPageDataService.getBuildPageData()
				if (!buildPageData) {
					SDK.notifyLoadSucceeded()
					return
				}
				const { build, definition } = buildPageData

				const buildClient = getClient(BuildRestClient)

				const files = await getArtifactsFileEntries(buildClient, project.id, build.id)

				const logTexts = await Promise.all(files.map(async file => {
					let contents = await file.contentsPromise
					if (contents.match(/^\uFEFF/)) {
						contents = contents.replace(/^\uFEFF/, ''); // Trim BOM to avoid 'Unexpected token ﻿ in JSON at position 0'.
					}
					return contents
				}))

				const logs = logTexts.map(log => {
					if (log === '') {
						return undefined
					}
					try {
						return JSON.parse(log) as Log
					} catch (e) {
						return undefined
					}
				}).filter(log => log)

				// Make sure each run has a property bag
				logs.forEach(log => log.runs.forEach(run => run.properties = run.properties || {}))

				const toolNames = logs.map(log => {
					return log.runs
						.filter(run => run.tool.driver) // Guard against old versions.
						.map(run => run.tool.driver.name)
				})
				const toolNamesSet = new Set([].concat(...toolNames))

				// Show file names when the tool names are homogeneous.
				if (files.length > 1) {
					logs.forEach((log, i) =>
						log.runs.forEach(run => {
							run.properties = run.properties || {}
							run.properties['logFileName'] = files[i].name
						})
					)
				}

				const buildProps = await buildClient.getBuild(project.name, build.id)
				logs.forEach((log, i) =>
					log.runs.forEach(run => {
						// Add a versionControlProvenance if one is not already present.
						if (!run.versionControlProvenance?.[0]) {
							run.versionControlProvenance = [{
								repositoryUri: buildProps.repository.url,
								revisionId: buildProps.sourceVersion,
							}];
						}

						// Metadata for use by the web component.
						run.properties['artifactName'] = files[i].artifactName
						run.properties['filePath'] = files[i].filePath
						run.properties['buildId'] = files[i].buildId
					})
				)

				runInAction(() => {
					this.logs = logs
					this.toolNames = toolNamesSet
					this.pipelineId = `${organization}.${definition.id}`
					this.user = user.name
				})

				SDK.notifyLoadSucceeded()

			})()
	}

	render() {
		const { logs, toolNames, user } = this
		const numberOfScans = toolNames?.size ?? 0
		return !logs || logs.length
			? <Viewer
				logs={logs}
				filterState={{
					Baseline: { value: ['new', 'updated', 'absent'] }, // Focusing on incremental changes.
					Level: { value: ['error', 'warning'] },
					Suppression: { value: ['unsuppressed'] },
				}}
				user={user}
				showActions={this.tenant === '72f988bf-86f1-41af-91ab-2d7cd011db47'}
				successMessage={`No results found after running ${numberOfScans} scan${numberOfScans !== 1 ? 's' : ''}`}
			/>
			: <div className="full">
				No SARIF logs found. Logs must be placed within an Artifact named "CodeAnalysisLogs".
				<a href="https://learn.microsoft.com/en-us/azure/devops/pipelines/artifacts/pipeline-artifacts?view=azure-devops&tabs=yaml" target="_blank" className='noArtifactLearnMore'>Learn more</a>
			</div>
	}
}

ReactDOM.render(<Tab />, document.getElementById("app"))

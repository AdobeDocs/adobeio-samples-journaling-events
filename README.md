# adobeio-samples-custom-events-using-journaling

Welcome to my Adobe I/O Application! By reading this repo, we assume that you already know basic Project Firefly App development 
If not, please refer to [Project Firefly Developer Guide](https://github.com/AdobeDocs/project-firefly)

## Background

- This is a Project Firefly APP work as a POC example for high availability solution for cosuming events by using journaling API for a codelab 

## Problem 

- There is a class of Firefly apps in which customers want guarantees that the I/O Events are processed (there are no events lost due to an error in Runtime).
current webhook based solution (the code running on Runtime would be made available as a webhook and I/O Events will deliver events to that webhook) is the push mode which not provide a solution for the peak event load case. Today, in case there is a surge of events a Runtime webhook would return 429 responses beyond the concurrency limit, thereby causing the webhook to be marked unreachable and causing no further events to be delivered – even when the surge stops.
In this POC, we consume events via the [Journaling API](https://www.adobe.io/apis/experienceplatform/events/docs.html#!adobedocs/adobeio-events/master/api/journaling_api.md) in a way that a client could always "ride the peak" by trading-off the near real-time guarantee in the process.


## Solution

- Use the Journaling API to retrieve the events instead of relying on the webhook approach.
- Use a runtime action that uses the Alarm package to read the events every X minutes 
- The Alarm action store the events in the Firefly storage.
- Index of events has been recorded in storage that if the action fails, the next invocation will retrieve from the same index, thus no events are lost

## How to use 

This repo contains two folder
- Event provider 
- Event consumer 

### Event provider 
In this folder, we create a custom event publisher which takes care of generating events, then we use project firefly alarms packages to automate it. 
e.g. 100 events / min. This events is configured to send to Journaling API, so the event consumer could consume these events from there. 

More details about how to set up custom events and alarm package:
[custom events](https://adobeio-codelabs-custom-events-adobedocs.project-helix.page/)
[alarm package](https://adobeio-codelabs-alarms-adobedocs.project-helix.page/)

### Event consumer 
This folder contains the event consumer, we create another Project Firefly headless app to create cron jobs with alarms, we set up recurring jobs to pull from 
journalling API every x mins and write into project firefly storage. Project Firefly using [aio-lib-state](https://github.com/adobe/aio-lib-state) as storage library 

More details about how to set up aio-lib-state storage:
[Building a Firefly Todo App with aio-lib-state and React Spectrum](https://adobeio-codelabs-react-spectrum-crud-adobedocs.hlx.page/?src=/README.html)


### More
Event provider and Event consumer both need to be deployed as a Project Firefly App under different namespace to make sure end to end workflow.
So for that purpose, you may need to create two projects at Console 
[Creating your First Project Firefly Application](https://github.com/AdobeDocs/project-firefly/blob/master/getting_started/first_app.md)

If successfully set up, you should be able to see events been wroten into storage pulled from jouranling API periodically. For your debugging purpose
I also provide a sample code to send the event to slack webhook. 

import { Option, option } from "ts-option";

import { left, right } from "../either";
import { IRequestMiddleware } from "../request_middleware";
import {
  IResponseErrorForbiddenAnonymousUser,
  IResponseErrorForbiddenNoAuthorizationGroups,
  IResponseErrorForbiddenNotAuthorized,
  ResponseErrorForbiddenAnonymousUser,
  ResponseErrorForbiddenNoAuthorizationGroups,
  ResponseErrorForbiddenNotAuthorized
} from "../response";
import { NonEmptyString, toNonEmptyString } from "../strings";

/*
 * A middle ware that extracts authentication information from the
 * request.
 */

/**
 * Enumerates all supported Azure user groups.
 *
 * Each groups is named after a Scope.
 * A Scope associates an Access Type to a Resource.
 */
export enum UserGroup {
  // profiles: read limited profile (without addresses)
  ApiLimitedProfileRead = "ApiLimitedProfileRead",
  // profiles: read full profile (with addresses)
  ApiFullProfileRead = "ApiFullProfileRead",
  // profiles: create and update full profile
  ApiProfileWrite = "ApiProfileWrite",

  // services: read services attributes
  ApiServiceRead = "ApiServiceRead",
  // services: create and update services
  ApiServiceWrite = "ApiServiceWrite",

  // messages: read sent message
  ApiMessageRead = "ApiMessageRead",
  // messages: send messages
  ApiMessageWrite = "ApiMessageWrite",
  // messages: send messages only to authorized receipts (used for trial)
  ApiLimitedMessageWrite = "ApiLimitedMessageWrite",
  // messages: ability to set default address when sending a message
  ApiMessageWriteDefaultAddress = "ApiMessageWriteDefaultAddress",
  // messages: list all messages for any recipient
  ApiMessageList = "ApiMessageList",

  // info: read system information
  ApiInfoRead = "ApiInfoRead",

  // debug endpoint
  ApiDebugRead = "ApiDebugRead"
}

/**
 * Looks up a UserGroup by name
 */
function toUserGroup(name: string): Option<UserGroup> {
  return option(UserGroup[name as keyof typeof UserGroup]);
}

/**
 * Azure authorization info
 */
export interface IAzureApiAuthorization {
  readonly kind: "IAzureApiAuthorization";
  readonly groups: Set<UserGroup>;
  readonly userId: NonEmptyString;
  readonly subscriptionId: NonEmptyString;
}

/**
 * Returns an array of group names from a groups header.
 *
 * Expects a comma separated list of group names.
 */
function getGroupsFromHeader(groupsHeader: string): Set<UserGroup> {
  return new Set(
    groupsHeader
      .split(",")
      .map(v => toUserGroup(v))
      .filter(g => g.isDefined)
      .map(g => g.get)
  );
}

/**
 * A middleware that will extract the Azure API Management authentication
 * information from the request.
 *
 * The middleware expects the following headers:
 *
 *   x-user-groups:   A comma separated list of names of Azure API Groups
 *
 * On success, the middleware generates an IAzureApiAuthorization, on failure
 * it triggers a ResponseErrorForbidden.
 *
 */
export function AzureApiAuthMiddleware(
  allowedGroups: Set<UserGroup>
): IRequestMiddleware<
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorForbiddenAnonymousUser
  | IResponseErrorForbiddenNoAuthorizationGroups,
  IAzureApiAuthorization
> {
  return request =>
    new Promise(resolve => {
      // get Azure userId and subscriptionId from the headers
      // these headers get added by the Azure API Manager gateway
      const maybeUserId = toNonEmptyString(request.header("x-user-id"));
      const maybeSubscriptionId = toNonEmptyString(
        request.header("x-subscription-id")
      );

      if (maybeUserId.isEmpty || maybeSubscriptionId.isEmpty) {
        // we cannot proceed unless we cannot associate the request to a
        // valid user and a subscription
        return resolve(left(ResponseErrorForbiddenAnonymousUser));
      }

      const userId = maybeUserId.get;
      const subscriptionId = maybeSubscriptionId.get;

      // to correctly process the request, we must associate the correct
      // authorizations to the user that made the request; to do so, we
      // need to extract the groups associated to the authenticated user
      // from the x-user-groups header, generated by the Azure API Management
      // proxy.
      const maybeGroupsHeader = toNonEmptyString(
        request.header("x-user-groups")
      );
      const maybeGroups = maybeGroupsHeader
        .map(getGroupsFromHeader) // extract the groups from the header
        .filter(hs => hs.size > 0); // filter only if set of groups is non empty

      if (maybeGroups.isEmpty) {
        // the use as no valid authorization groups
        return resolve(left(ResponseErrorForbiddenNoAuthorizationGroups));
      }

      // now we have some valid groups that the users is part of
      const groups = maybeGroups.get;

      // helper that checks whether the user is part of a specific group
      const userHasOneGroup = (name: UserGroup) => groups.has(name);

      // whether the user is part of at least an allowed group
      const userHasAnyAllowedGroup =
        Array.from(allowedGroups).findIndex(userHasOneGroup) > -1;

      if (!userHasAnyAllowedGroup) {
        // the user is not allowed here
        return resolve(left(ResponseErrorForbiddenNotAuthorized));
      }

      // the user is allowed here
      const authInfo: IAzureApiAuthorization = {
        groups,
        kind: "IAzureApiAuthorization",
        subscriptionId,
        userId
      };

      resolve(right(authInfo));
    });
}
